import asyncio
from dotenv import load_dotenv
import redis
import json
import time
import uuid
import os
import traceback


load_dotenv()

REDIS_IP = os.environ.get('REDIS_IP')
redis_client = redis.Redis(host=REDIS_IP, port=6379, db=0, decode_responses=True)
family_config_file = os.environ.get('FAMILY_CONFIG_PATH')


'''
redis:
last_user_interaction

'''


'''
Cron jobs interacting with Redis:

'''


class TemiScheduler:
    """
    Controls the robot's behavior when it's not actively interacting with users.

    It drives a round following a pre-definied route, takes pictures, takes note of things (or people)
    that might be of interest, and finds people to remind them about these things.

    # TODO: periodic checks for battery level, etc.
    """
    def __init__(self, websocket):
        self.status = None
        # (on-route:)waypoint name, "user" if following user
        # TODO: need listener for robot movement status (e.g. "arrived at")
        self.location = ""
        self.websocket = websocket
        self.refresh_time_file = 0
        self.refresh_interval_file = 60
        self.family_config_json = {}
        self.family_config_db = {}
        self.identified_chores = []
        # self.user_actions = 
        self.current_waypoint = None
        self.current_turn_index = None
        self.snapshot_status = None
        self.pending_requests = {}

        self._refresh_config_from_file()


    def _refresh_config_from_file(self):
        """
        These are more static, set by researchers
        """
        try:
            with open(family_config_file, 'r') as f:
                self.family_config_json = json.load(f)
            self.refresh_time_file = time.time()
        except Exception as e:
            print(f"Error loading family config from file: {e}")
            self.family_config_json = {}


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

    async def request_snapshot(self):
        print('[scheduler] request_snapshot')
        if self.websocket:
            request_id = str(uuid.uuid4())
            future = asyncio.get_event_loop().create_future()
            self.pending_requests[request_id] = future
            await self.websocket.send_json({
                "type": "take_snapshot",
                "request_id": request_id
            })
            try:
                result = await asyncio.wait_for(future, timeout=30)
                return result
            except asyncio.TimeoutError:
                print(f"[scheduler] Snapshot request {request_id} timed out after 30 seconds.")
                self.pending_requests.pop(request_id, None)
                return None
        else:
            print('No active websocket connection.')
            return None

    def handle_api_event(self, message):
        print("scheduler: handle_api_event")
        print(message)
        request_id = message.get("request_id")

        try:
            if message["type"] in ["snapshot_uploaded"] and request_id in self.pending_requests:
                # TODO: depending on state, decide what we want to do with this snapshot
                # e.g. YOLO? LLM?
                # Then just enqueue it to redis with relevant info and move on
                # Example data
                data = {
                    "image_path": message['path'],
                    "task": "detect_people",
                    "request_id": message['request_id']
                }

                redis_client.rpush("image_queue", json.dumps(data))

                self.pending_requests[request_id].set_result(data)
                del self.pending_requests[request_id]
                print('handled data')
        except Exception as e:
            print(f'[ERROR][handle_api_event] {e}')

    async def on_ws_message(self, message):
        print("scheduler: on_ws_message")
        data = json.loads(message)
        print(data)
        request_id = data.get("request_id")

        if data["type"] in ["snapshot_result"] and request_id in self.pending_requests:
            self.pending_requests[request_id].set_result(data)
            del self.pending_requests[request_id]
            print('handled data')

    def _take_and_process_snapshot(self):
        pass


    def get_next_action(self):
        """
        High-level plan:
            - Move to wp1
            - Turn and take pictures
                - separate worker processes the pictures
            - At the end of movement route, check if anything in Redis
                - Yes: try and see if anyone is around, move around way points
                - No: Remember the status of things but go back to resting position
        """

        print('getting next action')
        movement_plan = self.family_config_json.get("movement_plan", [])
        return self.request_snapshot


    async def main_loop(self):
        now = time.time()
        if now - self.refresh_time_file > self.refresh_interval_file:
            self._refresh_config_from_file()

        # TODO: check redis results

        _next = self.get_next_action()
        await _next()


    async def start_loop(self):
        while True:
            try:
                await self.main_loop()
            except Exception as e:
                print(f"[Scheduler Error] {e}")
                traceback.print_exc()
            print('scheduling next action')
            await asyncio.sleep(30)
        
        