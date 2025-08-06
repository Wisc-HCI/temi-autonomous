import asyncio
import websockets
import json

async def send_message():
    uri = "ws://localhost:8000/control"
    async with websockets.connect(uri) as websocket:
        await websocket.send(json.dumps({
            "command": "queryLocations",
            "payload": "" 
        }))
    response = await websocket.recv()
    print("Received:", response)


asyncio.run(send_message())