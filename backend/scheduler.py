import asyncio
from functools import partial
import datetime
from dotenv import load_dotenv
import random
import redis
from redis import asyncio as aioredis

import json
import time
import uuid
import os
import traceback

from utils import (
    log_key_event, save_message,
    log_image_analysis
)


load_dotenv()

REDIS_IP = os.environ.get('REDIS_IP')
# redis_client = redis.Redis(host=REDIS_IP, port=6379, db=0, decode_responses=True)
redis_client = aioredis.from_url("redis://localhost", decode_responses=True)

family_config_file = os.environ.get('FAMILY_CONFIG_PATH')


'''
TODO:

==========
Check-in for morning routines
    - state info about tasks, current reminders, etc.
    - respond_to_check_in in LLM
Inject LLM state with context and reminders relevant info.
==========

==========
Parent trigger a routine/reminder?
==========

TEST camera on/off over long period of time


'''


'''
Cron jobs interacting with Redis:

'''


class TemiScheduler:
    """
    Controls the robot's behavior when it's not actively interacting with users.
    """
    def __init__(self, websocket):
        self.location = ""
        self.goto_status = {}
        self.websocket = websocket
        self.refresh_time_file = 0
        self.refresh_interval_file = 60
        self.family_config_json = {}
        self.family_config_db = {}
        self.identified_chores = []
        self.movement_plan = []
        # self.user_actions = 
        self.next_waypoint_index = 0
        self.current_turn_index = None
        self.snapshot_status = None
        self.pending_requests = {}
        self.location_tasks = {}
        self.active_tasks = []
        self.current_location = None
        self.movement_plan_updated_at = 0
        self.last_user_interaction = 0
        self.last_system_speech = 0
        self.privacy_mode_updated = 0
        self.privacy_mode = None
        self.last_battery_check = 0
        self.battery_percent = 200
        self.is_charging = None
        self.start_of_day = None
        self.end_of_day = None
        self.family_members = []
        self.pause_snapshots_until = 0
        self.last_interaction_snapshot = 0
        self.turn_privacy_off_at = None
        self.secondary_task = None
        self.current_date_str = datetime.datetime.now().strftime('%Y/%m/%d')
        self.prev_sent_manual_tasks = []
        self.active_manual_triggers = {}
        self._refresh_config_from_file()

    async def _get_status(self):
        return await redis_client.get('status')
    
    async def _get_status_updated(self):
        timestamp = await redis_client.get('status_updated')
        return int(timestamp)
    
    async def _set_status(self, value):
        await redis_client.set('status', value)
        await redis_client.set('status_updated', int(time.time()))
    
    def _refresh_config_from_file(self):
        """
        These are more static, set by researchers
        """
        now = datetime.datetime.now()
        current_date = now.strftime('%Y/%m/%d')
        self.current_date_str = current_date
        try:
            with open(family_config_file, 'r') as f:
                self.family_config_json = json.load(f)
            self.refresh_time_file = time.time()
            tasks = self.family_config_json.get(current_date, {})
            first_start = datetime.datetime.strptime("23:59", "%H:%M").time()
            last_end = datetime.datetime.strptime("00:01", "%H:%M").time()
            for _, task in tasks.items():
                start_time = datetime.datetime.strptime(task['start'], "%H:%M").time()
                end_time = datetime.datetime.strptime(task['end'], "%H:%M").time()
                if start_time < first_start:
                    first_start = start_time
                if end_time > last_end:
                    last_end = end_time
            self.start_of_day = datetime.datetime.combine(now.date(), first_start)
            self.end_of_day = datetime.datetime.combine(now.date(), last_end)
            self.family_members = self.family_config_json['family_members'].keys()
            # redis_client.sadd("users", *family_members)

        except Exception as e:
            print(f"Error loading family config from file: {e}")
            self.family_config_json = {}


    def get_active_manual_triggers(self):
        # return {'name': {'task': 'reminder content', ...}, ...}
        res = {}
        for task in self.active_tasks:
            task_info = self.family_config_json[self.current_date_str].get(task)
            if not task_info:
                continue
            if task_info.get('allow_manual_trigger') is True:
                name = task_info.get('who')
                if name:
                    if name in res:
                        res[name].append(task)
                    else:
                        res[name] = [task]

        self.active_manual_triggers = res
        print('manual trigger active tasks:')
        print(res)
        return res


    def _refresh_config_from_db(self):
        """
        These are family configurations they can access and update through the web UI
        """
        try:
            pass
            # with open(family_config_file, 'r') as f:
            #     self.family_config_db = json.load(f)
            # self.refresh_time = time.time()
        except Exception as e:
            print(f"Error loading family config from db: {e}")
            self.family_config_db = {}

    async def _generate_plan(self):
        active_tasks = []
        location_tasks = {}
        now = datetime.datetime.now()
        tasks = self.family_config_json.get(self.current_date_str, {})
        skip_task = None
        if self.secondary_task:
            tasks['secondary-task'] = self.secondary_task
            skip_task = self.secondary_task['original_task']

        # get tasks for current date
        inactive_tasks = await redis_client.lrange(f'inactive_tasks:{self.current_date_str}', 0, -1)
        print('inactive_tasks: ', inactive_tasks)
        for name, task in tasks.items():
            if name in inactive_tasks or name == skip_task:
                continue
            # Parse time strings into time objects
            start_time = datetime.datetime.strptime(task['start'], "%H:%M").time()
            end_time = datetime.datetime.strptime(task['end'], "%H:%M").time()
            now_time = now.time()
            if now_time > start_time and now_time < end_time:
                print(f"Task {name} is active!")
                active_tasks.append(name)
                last_triggered = await redis_client.get(f"last_triggered:{name}")
                if last_triggered and time.time() - int(last_triggered) < task['trigger_freq']:
                    continue
                
                # for tasks with multiple locations and depend on duration trigger
                # prioritize location where it was previously triggered
                potential_locations = task['where']
                prev_location = await redis_client.get(f"{task}:true:location")
                if prev_location:
                    potential_locations = [prev_location]
                for location in potential_locations:
                    # check if need to check again based on frequency
                    last_checked = await redis_client.get(f"last_checked:{name}:{location}")
                    if last_checked and time.time() - int(last_checked) < task['trigger_check_freq']:
                        continue
                    if location in location_tasks:
                        location_tasks[location].append(name)
                    else:
                        location_tasks[location] = [name]
            elif now_time > end_time:
                if name == 'secondary-task':
                    print('Secondary task expiring. Removed.')
                    self.secondary_task = None
                    await redis_client.delete('secondary_task')

        self.active_tasks = active_tasks        
        self.location_tasks = location_tasks
        self.movement_plan = list(self.location_tasks.keys())
        self.next_waypoint_index = 0
        self.movement_plan_updated_at = time.time()

    async def request_snapshot(self, task_names, location=None, position=None):
        print('[scheduler] request_snapshot')
        if time.time() < self.pause_snapshots_until:
            print('[scheduler] Skipping request_snapshot since paused.')
            return None
        if self.websocket and self.privacy_mode is False:
            await self._set_status(f"capturing:{location}")
            request_id = str(uuid.uuid4())
            self.pending_requests[request_id] = {
                "location": location,
                "position": position,
                "task_names": task_names
            }
            await self.websocket.send_json({
                "command": "takePicture",
                "payload": request_id
            })
            # try:
            #     result = await asyncio.wait_for(future, timeout=30)
            #     self.status = "idle"
            #     return result
            # except asyncio.TimeoutError:
            #     print(f"[scheduler] Snapshot request {request_id} timed out after 30 seconds.")
            #     self.pending_requests.pop(request_id, None)
            #     self.status = "idle"
            #     return None
        else:
            print('No active websocket connection.')
            return None

    async def goToLocation(self, location):
        if self.websocket:
            if self.current_location == location and time.time() - self.arrived_at_location < 180:
                if location != 'home base':
                    task_names = self.location_tasks.get(location)
                    if task_names:
                        await self.request_snapshot(
                            task_names=self.location_tasks[location],
                            location=location
                        )
            else:
                self.goto_status = {
                    'location': location,
                    'status': 'sent_command',
                    'timestamp': time.time()
                }
                self.last_goto_command = time.time()
                await self._set_status(f"traveling:{location}")
                await self.websocket.send_json({
                    "command": "goTo",
                    "payload": location
                })
                log_key_event('going-to', location)

    async def handle_api_event(self, message):
        print("scheduler: handle_api_event")
        print(message)
        request_id = message.get("request_id")

        try:
            if message["type"] in ["snapshot_uploaded"] and request_id in self.pending_requests:
                # Then just enqueue it to redis with relevant info and move on
                # Example data
                request_context = self.pending_requests[request_id]
                if request_context['task_names'] == ['user-interaction']:
                    # no analysis needed for this, just save a ref to the last three of these
                    log_image_analysis(message['filename'], request_context)
                    # await redis_client.rpush("user-interaction-images", message['filename'])
                    # await redis_client.ltrim("user-interaction-images", -3, -1)
                    # await redis_client.expire("user-interaction-images", 60)
                    # TODO: do something with these
                else:
                    # otherwise, enqueue for analysis
                    data = {
                        "filename": message['filename'],
                        "task_names": request_context['task_names'],
                        "request_id": message['request_id'],
                        "position": request_context['position'],
                        "location": request_context['location']
                    }
                    await redis_client.rpush("image_queue", json.dumps(data))

                del self.pending_requests[request_id]
                await self._set_status("idle")
                print('handled data')
        except Exception as e:
            print(f'[ERROR][handle_api_event] {e}')

    async def on_ws_message(self, message):
        print("scheduler: on_ws_message")
        data = json.loads(message)
        print(data)
        request_id = data.get("request_id")

        if data["type"] in ["snapshot_result"] and request_id in self.pending_requests:
            self.pending_requests[request_id]['future'].set_result(data)
            del self.pending_requests[request_id]
            print('handled data')

        elif data["type"] == "goto_status":
            self.goto_status = data['data']
            self.goto_status['timestamp'] = time.time()
            location = self.goto_status['location']
            if self.goto_status['status'] == 'complete':
                print(f'Arrived at {location}')
                log_key_event('arrived-at', location)
                await redis_client.set('current_location', location)
                self.arrived_at_location = time.time()
                self.current_location = location
                if location != 'home base':
                    print('Requesting snapshot')
                    # Issue capture request
                    task_names = self.location_tasks.get(location)
                    if task_names:
                        await self.request_snapshot(
                            task_names=task_names,
                            location=location
                        )

        elif data['type'] == 'privacy_mode_changed':
            print(f'privacy_mode_changed to: {data["data"]}')
            self.privacy_mode_updated = time.time()
            if self.privacy_mode != bool(data['data']):
                self.privacy_mode = bool(data['data'])
                log_key_event('privacy_mode_change', data['data'])
        
        elif data['type'] == 'battery_status':
            print(f'battery_status: {data["data"]}')
            self.battery_percent = int(data['data']['percent'])
            self.is_charging = data['data']['is_charging']
            self.last_battery_check = time.time()
            log_key_event('battery_percent', data['data']['percent'])
            await redis_client.set('battery_percent', data['data']['percent'])

        elif data['type'] == 'asr_result':
            if data['data'] != '<no response detected>':
                self.last_user_interaction = time.time()
        
        elif data['type'] == 'bewithme_changed':
            self.last_user_interaction = time.time()
            self.current_location = 'follow-user'
            await redis_client.set('current_location', location)

        elif data['type'] == 'turn_privacy_off_after':
            self.turn_privacy_off_at = time.time() + int(data['data']) * 60

        elif data['type'] == 'manual_task_trigger':
            self.last_user_interaction = time.time()
            print('manual_task_trigger for: ')
            print(data['data'])
            tasks = self.active_manual_triggers.get(data['data'], [])
            for task in tasks:
                print(f'triggering: {task}')
                log_key_event('intention_for_action', f'manual;{task}')
                await redis_client.rpush('robot_action', task)

    async def _fetch_privacy_status(self):
        if self.websocket:
            await self.websocket.send_json({
                "command": "privacyStatus"
            })
    
    async def _fetch_battery_status(self):
        if self.websocket:
            await self.websocket.send_json({
                "command": "batteryStatus"
            })
    
    async def _stop_robot(self):
        if self.websocket:
            await self.websocket.send_json({
                "command": "stopMovement"
            })

    async def _turn_camera_off(self):
        if self.websocket:
            print('_turn_camera_off triggered.')
            await self.websocket.send_json({
                "command": "cameraControl",
                "payload": "off"
            })
            # clear all pending requests
            self.pending_requests = {}
            # pause pictures for 30 secs
            self.pause_snapshots_until = time.time() + 90
    
    async def _toggle_privacy(self, value):
        if self.websocket:
            await self.websocket.send_json({
                "command": "privacyToggle",
                "payload": value
            })
            await redis_client.set(f'privacy_{value}:{self.current_date_str}', 1)
            if value == 'off':
                self.turn_privacy_off_at = None
    
    async def _update_manual_active_tasks_UI(self):
        if self.websocket:
            new_keys = list(self.get_active_manual_triggers().keys())
            print(self.prev_sent_manual_tasks)
            print(new_keys)
            if set(self.prev_sent_manual_tasks) != set(new_keys):
                await self.websocket.send_json({
                    "command": "manualTaskUpdate",
                    "payload": json.dumps(new_keys)
                })
                self.prev_sent_manual_tasks = new_keys

    async def _increment_trigger_count(self, task, max_trigger_count):
        key = f'{task}:count:{self.current_date_str}'
        new_value = await redis_client.incr(key)
        await redis_client.set(f'last_triggered:{task}', str(int(time.time())))
        if new_value >= max_trigger_count:
            print(f'Adding task {task} to inactive list.')
            await redis_client.rpush(f'inactive_tasks:{self.current_date_str}', task)
        return new_value

    async def _perform_triggerred_action(self, task):
        is_secondary_task = False
        if task == 'secondary-task':
            is_secondary_task = True
            task = self.secondary_task['original_task']
            self.secondary_task = None
        now = datetime.datetime.now()
        max_trigger_count = self.family_config_json[self.current_date_str].get(task, {}).get('max_trigger_count', 0)
        # Actually trigger robot action
        print(f'Triggering robot action for {task}')
        action = self.family_config_json[self.current_date_str].get(task, {}).get('trigger_action', {})
        speeches = action['say']
        # if secondary: just say it
        if 'find' not in action or is_secondary_task:
            new_value = await self._increment_trigger_count(task, max_trigger_count)
            try:
                speech = speeches[(new_value - 1) % len(speeches)]
            except Exception as e:
                print('Not enough speeches specified.')
                speech = random.choice(speeches)
            if self.websocket and speech:
                await self.websocket.send_json({
                    "command": "speak",
                    "payload": speech
                })
                await save_message('assistant', speech)
                self.last_system_speech = time.time()
                log_key_event('performed_action', f'{task} ({new_value}/{max_trigger_count})')
                await redis_client.set(
                    'last_trigger_task',
                    f'[{now.strftime("%Y-%m-%d %H:%M:%S")}] [{task}] ({new_value}/{max_trigger_count})'
                )
                await asyncio.sleep(10)
        else:
            # find someone / something first
            # For now we will just keep one (in theory there could be multiple such tasks)
            who = action['find']
            where = action['where']
            print(f'{task} requires: Find {who} at {where}')
            if who == 'anyone':
                vision_trigger = '<anyone>'
            else:
                vision_trigger = 'Either of these persons is present: '
                for name in who.split(';'):
                    vision_trigger += f'<{name.lower()}-description>, '
            current_time = datetime.datetime.now()
            end_time = current_time + datetime.timedelta(minutes=10)
            self.secondary_task = {
                "original_task": task,
                "start": current_time.strftime("%H:%M"),
                "end": end_time.strftime("%H:%M"),
                "vision_trigger": vision_trigger,
                "where": where,
                "max_trigger_count": 999,
                "duration_trigger": None,
                "trigger_check_freq": 10,
                "trigger_freq": 0
            }
            await redis_client.set('secondary_task', json.dumps(self.secondary_task))
            log_key_event('triggered_secondary_action', f'{task}: (triggering secondary task to find {who})')
        # Make sure same trigger/task at other locations are skipped, too
        await self._generate_plan()
        await self._update_manual_active_tasks_UI()

    async def get_next_action(self):
        """
        High-level plan:
        """
        _next = None
        print('getting next action')

        if self.battery_percent < 10:
            _next = partial(
                self.goToLocation,
                "home base"
            )
            return _next
    
        # see if robot should announce anything first
        tasks_with_actions = await redis_client.lrange('robot_action', 0, -1)
        for task in tasks_with_actions:
            await self._perform_triggerred_action(task)
        await redis_client.delete('robot_action')
    
        if self.battery_percent < 20 and self.is_charging:
            print('Robot is still charging. Let it rest.')
            return None
        
        if self.privacy_mode:
            print('Robot is in privacy mode.')
            # for now just stay where it is
            # _next = partial(
            #     self.goToLocation,
            #     "home base"
            # )
            return None
        
        if time.time() - self.last_system_speech < 60:
            return None

        status = await self._get_status()
        status_updated = await self._get_status_updated()

        if status == 'idle':

            # check if we have a movement plan / if we need a new one
            if len(self.movement_plan) == 0:
                if time.time() - self.movement_plan_updated_at > 30:
                    await self._generate_plan()
            elif self.next_waypoint_index >= len(self.movement_plan):
                await self._generate_plan()

            print('Finished generating plans...')

            # stay at home base if nothing of interest
            if len(self.active_tasks) == 0:
                print('No active tasks. Returning to home base.')
                _next = partial(
                    self.goToLocation,
                    "home base"
                )
                return _next

            # user interactions
            if time.time() - self.last_user_interaction < 60 * 3:
                print('User interaction in progress.')
                # stay put, but maybe capture snapshot
                _next = None
                if time.time() - self.last_interaction_snapshot > 20:
                    # TODO: Test this / but anyway we're not doing this for now
                    _next = partial(
                        self.request_snapshot,
                        ['user-interaction']
                    )
                    self.last_interaction_snapshot = time.time()
                return _next

            # if we're (possibly) back at homebase and we have recent context. Rest a bit.
            # TODO: check if Temi has api to check if we're on homebase
            print(f"next_waypoint_index: {self.next_waypoint_index}")
            print(f"movement_plan: {len(self.movement_plan)}")
            # self.last_context_timestamp = await self._get_last_context_timestamp()
            # if self.last_context_timestamp and self.goto_status != {}:
            #     if self.goto_status['status'] == 'complete' and self.goto_status['location'] == 'home base':
            #         if time.time() - self.last_context_timestamp < 20 * 60:
            #             print('At home base and latet context timestamp is less than 20 minutes. Staying Put.')
            #             return None
            if len(self.movement_plan) == 0:
                if self.battery_percent < 20:
                    _next = partial(
                        self.goToLocation,
                        "home base"
                    )
                else:
                    _next = None
            else:
                _next = partial(
                    self.goToLocation,
                    self.movement_plan[self.next_waypoint_index]
                )
                # TODO: Add retries, maybe
                self.next_waypoint_index += 1

        else:
            time_lapsed = time.time() - status_updated
            if status.startswith('traveling') and time_lapsed > 120:
                print('Maybe stuck traveling. Resetting status to idle.')
                await self._set_status('idle')
            elif status.startswith('capturing') and time_lapsed > 30:
                print('Maybe stuck capturing. Resetting status to idle.')
                await self._set_status('idle')
                self.status_updated = time.time()

        # _next = self.request_snapshot
        return _next

    async def main_loop(self):
        now = time.time()
        if now - self.refresh_time_file > self.refresh_interval_file:
            self._refresh_config_from_file()
            await self._update_manual_active_tasks_UI()

        if now - self.last_battery_check > 60 * 10:
            await self._fetch_battery_status()

        if now - self.privacy_mode_updated > 60 * 15:
            # reset this every once in a while to trigger a potentially redundant update
            self.prev_sent_manual_tasks = []
            await self._fetch_privacy_status()
            #  also handle auto-toggle on/off in here
            dt_now = datetime.datetime.now()
            if dt_now.hour > 1:
                privacy_off_toggled = await redis_client.get(f'privacy_off:{self.current_date_str}')
                privacy_on_toggled = await redis_client.get(f'privacy_on:{self.current_date_str}')
                if not privacy_off_toggled and self.start_of_day:
                    if self.start_of_day - dt_now <= datetime.timedelta(minutes=20):
                        # start trying to toggle privacy to off to start the day
                        print('Trying to toggle privacy OFF to start the day')
                        await self._toggle_privacy('off')
                if not privacy_on_toggled and self.end_of_day:
                    if dt_now - self.end_of_day > datetime.timedelta(minutes=10):
                        # start trying to toggle privacy to ON to end the day
                        print('Trying to toggle privacy ON to end the day')
                        await self._toggle_privacy('on')     

        if self.turn_privacy_off_at and now > self.turn_privacy_off_at:
            await self._toggle_privacy('off')

        if len(self.pending_requests) > 5:
            # something wrong with camera, let's restart it
            await self._turn_camera_off()

        if self.websocket:
            _next = await self.get_next_action()
            if _next:
                await _next()
            else:
                print('No action required. Staying put!')

    async def start_loop(self):
        await self._set_status('idle')
        while True:
            try:
                await self.main_loop()
            except Exception as e:
                print(f"[Scheduler Error] {e}")
                traceback.print_exc()
            print('scheduling next action')
            await asyncio.sleep(10)
        
        