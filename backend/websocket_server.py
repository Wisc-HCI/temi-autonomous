import asyncio
from dotenv import load_dotenv
import json
import os
import time
from websockets.asyncio.server import serve
from fastapi import WebSocketDisconnect
import signal
from llm_model import LLMAgent
from utils import log_event


load_dotenv()


ZOOM_JWT = os.environ.get('ZOOM_JWT')

PATH_TEMI = '/temi'
PATH_CONTROL = '/control'
PATH_PARTICIPANT = '/participant'
LOG_FILE = 'participant_data/log.log'
MESSAGES_FILE = 'participant_data/messages.json'
UPLOAD_DIR = "participant_data/media"
MEDIA_INDEX_FILE = os.path.join(UPLOAD_DIR, "display_list.txt")

llm_agent = LLMAgent()


try:
    with open(MESSAGES_FILE, 'r') as f:
        MESSAGES = json.load(f)
except Exception as e:
    print('[ERROR] No messages file. Set to empty')
    MESSAGES = []



'''
photo, video
    - display 
    - capture
'''

REACTIVE = 'reactive'
PROACTIVE = 'proactive'


class WebSocketServer:
    def __init__(self, scheduler=None):
        self.connections = {
            PATH_TEMI: set(),
            PATH_CONTROL: set(),
            PATH_PARTICIPANT: set()
        }
        self.zoom_status_call_start = 0
        self.zoom_status_robot = None
        self.zoom_status_participant = None
        self.behavior_mode = None
        self.last_displayed = None
        self.messages = self._load_messages()
        self.scheduler = scheduler
        llm_agent.scheduler = scheduler


    def _load_messages(self):
        try:
            with open(MESSAGES_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            print('[ERROR] No messages file. Set to empty')
            return []

    def save_messages(self):
        with open(MESSAGES_FILE, 'w') as f:
            json.dump(self.messages, f, indent=4)

    async def handle_connection(self, websocket, ws_path):
        self.connections[ws_path].add(websocket)
        if ws_path == PATH_TEMI:
            self.scheduler.websocket = websocket
        try:
            while True:
                message = await websocket.receive_text()
                print(message[:100])
                log_event('received', ws_path, message[:200])
                if message == '':
                    pass
                if ws_path == PATH_TEMI:
                    await self.temi_handler(websocket, message)
                elif ws_path == PATH_CONTROL:
                    await self.control_handler(websocket, message)
                # elif ws_path == PATH_PARTICIPANT:
                #     await self.participant_handler(websocket, message)
                else:
                    # No handler for this path; close the connection.
                    return
        except WebSocketDisconnect:
            print(f"[{ws_path}] Disconnected")
        finally:
            if websocket in self.connections[ws_path]:
                self.connections[ws_path].remove(websocket)
            print(self.connections)
            if ws_path == PATH_TEMI:
                self.scheduler.websocket = None

    async def send_message(self, group, message):
        # we really just expect one to be in the set
        print(f'Sending message to {group}: {str(message)[:100]}')
        log_event('sent', group, str(message)[:200])
        for connection in self.connections[group]:
            await connection.send_json(message)
            # try:
            #     await connection.send(json.dumps(message))
            # except Exception as e:
            #     print(e)

    async def control_handler(self, websocket, message):
        # TODO: Check if Temi wants message or msg_json
        try:
            msg_json = json.loads(message)
        except Exception as e:
            print(f'[ERROR][control_handler]: {e}')
            return
        if 'command' not in msg_json:
            return
        if msg_json['command'] == 'speak':
            self.messages.append({
                'role': 'assistant',
                'content': msg_json['payload']
            })
            self.save_messages()
            await self.send_message(PATH_TEMI, msg_json)

        # elif msg_json['command'] == 'generate_response':
        #     img_path = None
        #     with_image = msg_json['payload']
        #     if with_image:
        #         # TODO
        #         # capture an image from Temi
        #         # include the path 
        #         # img_path = 
        #         pass
        #     res = generate_response(self.messages, img_path)
        #     if res:
        #         msg_2 = {
        #             'type': 'suggested_response',
        #             'data': res
        #         }
        #         await self.send_message(PATH_CONTROL, msg_2)

        elif msg_json['command'] == 'displayMedia':
            self.last_displayed = msg_json['payload']
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'displayFace':
            self.last_displayed = None
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'displayMode':
            await self.send_message(PATH_TEMI, msg_json)
            await self.send_message(PATH_PARTICIPANT, msg_json)

        elif msg_json['command'] == 'refreshScreenShot':
            if msg_json['payload'] == 'temi':
                await self.send_message(PATH_TEMI, msg_json)
            elif msg_json['payload'] == 'web':
                await self.send_message(PATH_PARTICIPANT, msg_json)

        elif msg_json['command'] in [
                'skidJoy', 'takePicture',
                'tiltBy', 'tiltAngle', 'stopMovement', 'turnBy',
                'queryLocations', 'goTo']:
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'navigateCamera':
            # for this project: whenever its admin capturing,
            #  we always do it headless
            msg_json['payload'] = 'headless'
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'startVideo':
            # TODO: behavior should differ depending on 
            # self.behavior_mode
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'stopVideo':
            # TODO:
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'changeMode':
            self.behavior_mode = msg_json['payload']
            msg = {
                'type': 'behavior_mode',
                'data': self.behavior_mode
            }
            await self.send_message(PATH_CONTROL, msg)
            await self.send_message(PATH_PARTICIPANT, msg)
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'allowCapture':
            await self.send_message(PATH_PARTICIPANT, msg_json)

        elif msg_json['command'] == 'zoomToken':
            msg_json['payload'] = ZOOM_JWT
            await self.send_message(PATH_TEMI, msg_json)

        elif msg_json['command'] == 'video_call':
            action = msg_json['payload']
            if action == 'proactive_call':
                self.zoom_status_robot = 'ringing'
                self.zoom_status_participant = 'ringing'
                participant_msg = {
                    'type': 'video_call',
                    'data': action
                }
                await self.send_message(PATH_TEMI, msg_json)
                await self.send_message(PATH_PARTICIPANT, participant_msg)
            elif action == 'end':
                self.zoom_status_robot = None
                self.zoom_status_participant = None
                call_duration = time.time() - self.zoom_status_call_start
                print(f'Call ended. Lasted {call_duration} seconds.')
                participant_msg = {
                    'type': 'video_call',
                    'data': 'end'
                }
                await self.send_message(PATH_TEMI, msg_json)
                await self.send_message(PATH_PARTICIPANT, participant_msg)
            elif action == "ending_alert":
                participant_msg = {
                    'type': 'video_call',
                    'data': 'ending_alert'
                }
                await self.send_message(PATH_TEMI, msg_json)
                await self.send_message(PATH_PARTICIPANT, participant_msg)

        elif msg_json['command'] == 'identify':
            if msg_json.get('payload') == 'webpage':
                msg = {
                    'type': 'initial_status',
                    'data': {
                        'behavior_mode': self.behavior_mode,
                        'last_displayed': self.last_displayed
                    }
                }
                await self.send_message(PATH_CONTROL, msg)

        elif msg_json['command'] == 'zoom_status':
            call_duration = None
            if self.zoom_status_robot == 'connected':
                call_duration = time.time() - self.zoom_status_call_start
            msg = {
                'type': 'zoom_status',
                'data': {
                    'participant': self.zoom_status_participant,
                    'robot': self.zoom_status_robot,
                    'call_duration': call_duration
                }
            }
            await self.send_message(PATH_CONTROL, msg)

    async def temi_handler(self, websocket, message):
        try:
            msg_json = json.loads(message)
        except Exception as e:
            print(f'[ERROR][temi_handler]: {e}')
            return
        if msg_json['type'] == 'asr_result':
            if msg_json['data'] != '<no response detected>':
                # generate response from gpt and send back to Temi
                res = await llm_agent.generate_response(msg_json['data'])
                msg = {
                    'command': 'speak',
                    'payload': res
                }
                await self.send_message(PATH_TEMI, msg)
            else:
                print('asr_result: No response from user.')
        elif msg_json['type'] == 'saved_locations':
            locations = msg_json.get("data", [])
            print(f"Received locations: {locations}")
            await self.send_message(PATH_CONTROL, msg_json)

        elif msg_json['type'] in [
                'screenshot', 'snapshot', 'video_recording', 'camera']:
            await self.send_message(PATH_CONTROL, msg_json)

        elif msg_json['type'] == 'declined_share':
            await self.send_message(PATH_PARTICIPANT, msg_json)

        elif msg_json['type'] == 'video_capture':
            await self.send_message(PATH_PARTICIPANT, msg_json)

        elif msg_json['type'] == 'share_media':
            filename = msg_json['data']
            with open(MEDIA_INDEX_FILE, "a") as f:
                f.write(f"{filename}\n")

            await self.send_message(PATH_CONTROL, {
                "type": "media_uploaded",
                "filename": filename,
                "url": f"/view/{filename}"
            })
            await self.send_message(PATH_PARTICIPANT, {
                "type": "media_uploaded",
                "filename": filename,
                "url": f"/view/{filename}"
            })

        # pass some messages to the temi scheduler
        if self.scheduler:
            await self.scheduler.on_ws_message(message)


    # async def participant_handler(self, websocket, message):
    #     try:
    #         msg_json = json.loads(message)
    #     except Exception as e:
    #         print(f'[ERROR][control_handler]: {e}')
    #         return
    #     if 'command' not in msg_json:
    #         return
    #     if msg_json['command'] in [
    #             'skidJoy', 'tiltBy', 'tiltAngle',
    #             'stopMovement', 'turnBy']:
    #         await self.send_message(PATH_TEMI, msg_json)

    #     elif msg_json['command'] == 'video_call':
    #         if msg_json['payload'] == 'answer':
    #             if self.behavior_mode == PROACTIVE:
    #                 if self.zoom_status_robot == 'ringing':
    #                     self.zoom_status_participant = 'waiting'
    #                     return
    #                 elif self.zoom_status_robot == 'waiting':
    #                     self.zoom_status_robot = 'connected'
    #                     self.zoom_status_participant = 'connected'
    #                     robot_msg = {
    #                         'command': 'video_call',
    #                         'payload': 'connected'
    #                     }
    #                     laptop_msg = {
    #                         'type': 'video_call',
    #                         'data': 'connected'
    #                     }
    #                     self.zoom_status_call_start = time.time()
    #                     await self.send_message(PATH_PARTICIPANT, laptop_msg)
    #                     await self.send_message(PATH_CONTROL, laptop_msg)
    #                     await self.send_message(PATH_TEMI, robot_msg)
    #                     return
    #             else:
    #                 self.zoom_status_robot = 'connected'
    #                 self.zoom_status_participant = 'connected'
    #                 self.zoom_status_call_start = time.time()
    #         elif msg_json['payload'] == 'dismiss':
    #             self.zoom_status_robot = None
    #             self.zoom_status_participant = None
    #         elif msg_json['payload'] == 'start':
    #             self.zoom_status_participant = 'calling'
    #             self.zoom_status_robot = 'ringing'
    #         elif msg_json['payload'] == 'end':
    #             self.zoom_status_robot = None
    #             self.zoom_status_participant = None
    #             call_duration = time.time() - self.zoom_status_call_start
    #             print(f'Call ended. Lasted {call_duration} seconds.')
    #             laptop_msg = {
    #                 'type': 'video_call',
    #                 'data': 'end'
    #             }
    #             await self.send_message(PATH_TEMI, msg_json)
    #             await self.send_message(PATH_CONTROL, laptop_msg)
    #             return
    #         await self.send_message(PATH_TEMI, msg_json)
    #         await self.send_message(PATH_CONTROL, msg_json)

    #     elif msg_json['command'] == 'screenshot':
    #         msg = {
    #             'type': 'screenshot',
    #             'data': msg_json['payload']
    #         }
    #         await self.send_message(PATH_CONTROL, msg)

    #     elif msg_json['command'] == 'initiate_capture':
    #         web_msg = {
    #             'type': 'initiate_capture',
    #             'data': msg_json['payload']
    #         }
    #         await self.send_message(PATH_CONTROL, web_msg)
    #         # robot msg
    #         # for this project: whenever its admin capturing,
    #         # we always do it headless
    #         robot_msg = {
    #             'command': 'navigateCamera',
    #             'payload': 'headless'
    #         }
    #         await self.send_message(PATH_TEMI, robot_msg)

    #     elif msg_json['command'] == 'identify':
    #         if msg_json.get('payload') == 'webpage':
    #             msg = {
    #                 'type': 'initial_status',
    #                 'data': {
    #                     'behavior_mode': self.behavior_mode,
    #                 }
    #             }
    #             await self.send_message(PATH_PARTICIPANT, msg)


# server = WebSocketServer()
# async def websocket_main():
#     async def handler(websocket):
#         await server.handle_connection(websocket)

#     server_proc = await serve(handler, "", 9090)
#     print("🚀 WebSocket server running on port 9090")

#     try:
#         await asyncio.Future()  # Run forever (until Ctrl+C)
#     except KeyboardInterrupt:
#         print("🛑 KeyboardInterrupt received, shutting down...")
#     finally:
#         server_proc.close()
#         await server_proc.wait_closed()
#         print("✅ Server stopped cleanly")
