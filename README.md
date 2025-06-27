This started out as a standalone web & websocket-server (fastAPI) & react frontend project,
where the WS acts as a bridge between the Temi robot and the frontend wizard controller.


This version of the code is intended to be run on a e.g. a Raspberry Pi that is deployed alongside Temi.

Backend serves these purposes:
1. Temi App, and;
2. A UI, possibly React app for users to configure things, and;
3. Support Temi interactions (e.g. conversations) and controlling Temi (mostly through WebSockets)
	such as commanding it to move from waypoint 1 to 2 based on context and schedules.

Frontend is the UI mentioned above.


This code is also dependent on a compatible Temi app (with WS client built-in) installed on Temi.
