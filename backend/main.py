import os
import shutil
import time
import json
import uuid
import datetime

import asyncio
from fastapi import (
    FastAPI, WebSocket, WebSocketDisconnect,
    Request, UploadFile, File, Form
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import SQLModel, create_engine, Session
from typing import Annotated
from pydantic import BaseModel
from redis import asyncio as aioredis

from websocket_server import WebSocketServer, PATH_TEMI, PATH_CONTROL, PATH_PARTICIPANT
from scheduler import TemiScheduler
from utils import log_event, log_key_event
from models import FamilyMember, ScheduledTask, TaskFlow, TaskItem, Chore



from dotenv import load_dotenv


load_dotenv()

sqlite_file_name = "robot_family.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
redis_client = aioredis.from_url("redis://localhost", decode_responses=True)

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


app = FastAPI()
scheduler = TemiScheduler(None)
server = WebSocketServer(scheduler)
UPLOAD_DIR = os.environ.get('UPLOAD_DIR')

os.makedirs(UPLOAD_DIR, exist_ok=True)

MEDIA_INDEX_FILE = os.path.join(UPLOAD_DIR, "display_list.txt")
ZOOM_JWT = os.environ.get('ZOOM_JWT')

app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")
app.mount("/static", StaticFiles(directory="static"), name="static")


# CORS is optional but useful during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]



@app.on_event("startup")
async def start_scheduler():
    SQLModel.metadata.create_all(engine)
    if os.environ.get("LOOP_ON") == "ON":
        asyncio.create_task(scheduler.start_loop())



@app.websocket(PATH_TEMI)
async def temi_ws(websocket: WebSocket):
    print(PATH_TEMI)
    await websocket.accept()
    await server.handle_connection(websocket, PATH_TEMI)


@app.websocket(PATH_CONTROL)
async def temi_ws(websocket: WebSocket):
    print(PATH_CONTROL)
    await websocket.accept()
    await server.handle_connection(websocket, PATH_CONTROL)



@app.get("/status")
def get_status():
    return {
        "behavior_mode": server.behavior_mode,
        "message_count": len(server.messages),
        "active_connections": {
            k: len(v) for k, v in server.connections.items()
        }
    }


@app.get("/manual_active_tasks")
async def manual_active_tasks():
    return scheduler.get_active_manual_triggers()


@app.get("/new_message_count")
async def new_message_count():
    since_day = datetime.datetime.now().date()
    count = 0
    async for key in redis_client.scan_iter("message:*"):
        raw = await redis_client.get(key)
        if raw:
            try:
                msg = json.loads(raw)
                msg_ts = float(msg.get("timestamp", 0))
                msg_day = datetime.datetime.fromtimestamp(msg_ts).date()

                if msg_day == since_day:
                    count += 1
            except Exception:
                continue
    return {"count": count}


@app.get("/message_board")
async def list_messages():
    messages = []
    async for key in redis_client.scan_iter("message:*"):
        raw = await redis_client.get(key)
        if raw:
            try:
                message = json.loads(raw)
                messages.append(message)
            except json.JSONDecodeError:
                continue  # Skip malformed messages

    # Optionally sort by timestamp if needed
    messages.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    log_key_event('message-board', 'checked')
    return messages


class ChatMessage(BaseModel):
    user: str
    message: str


@app.post("/message_board")
async def post_message(msg: ChatMessage):
    key = f"message:{uuid.uuid4().hex}"
    data = {
        "user": msg.user,
        "message": msg.message,
        "timestamp": time.time(),
        "display": datetime.datetime.now().strftime("%m/%d %I:%M%p"),
    }
    await redis_client.set(key, json.dumps(data))
    log_key_event('message-board', f'posted new message: {msg.message}')
    return {"status": "ok", "id": key}


@app.get("/users")
async def list_users():
    return list(scheduler.family_members)


@app.post("/members/")
def add_member(member: FamilyMember, session: SessionDep):
    with Session(engine) as session:
        session.add(member)
        session.commit()
        session.refresh(member)
        return member


@app.get("/members/")
def list_members(session: SessionDep):
    with Session(engine) as session:
        return session.query(FamilyMember).all()


@app.delete("/members/{member_ID}")
def delete_member(member_ID: int, session: SessionDep):
    member = session.get(FamilyMember, member_ID)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    session.delete(member)
    session.commit()
    return {"ok": True}



# @app.post("/add-media-to-display")
# async def add_media(request: Request):
#     print(request)
#     data = await request.json()
#     filename = data.get("filename", "").strip()
#     log_event('received', '/add-media-to-display', filename)
#     # Append filename
#     with open(MEDIA_INDEX_FILE, "a") as f:
#         f.write(f"{filename}\n")

#     await server.send_message(PATH_CONTROL, {
#         "type": "media_uploaded",
#         "filename": filename,
#         "url": f"/view/{filename}"
#     })
#     await server.send_message(PATH_PARTICIPANT, {
#         "type": "media_uploaded",
#         "filename": filename,
#         "url": f"/view/{filename}"
#     })
#     return JSONResponse(content={"message": "Added successfully"})


@app.post("/upload")
async def upload_file(
        file: UploadFile = File(...),
        request_id: str = Form(...)
    ):
    '''
    Aside from storing it, also announces it to the scheduler
    '''
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    log_event('received', '/upload', f"{file.filename} (request_id: {request_id})")

    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    msg = {
        "type": "snapshot_uploaded",
        "request_id": request_id,
        "filename": file.filename,
        "path": save_path,
    }

    await scheduler.handle_api_event(msg)
    return {
        "status": "success",
        "filename": file.filename,
        "path": save_path
    }


# mostly for thumbnails and Temi display
# @app.get("/view/{filename}", response_class=HTMLResponse)
# async def view_media(filename: str, request: Request):
#     file_url = f"/media/{filename}"
#     lower = filename.lower()
    
#     if lower.endswith((".jpg", ".jpeg", ".png", ".gif")):
#         tag = f'<img src="{file_url}" style="max-width: 90%; max-height: 80vh;" />'
#     elif lower.endswith((".mp4", ".webm")):
#         tag = (
#             f'<video controls autoplay style="max-width: 90%; max-height: 80vh;">'
#             f'<source src="{file_url}" type="video/mp4">Your browser does not support the video tag.</video>'
#         )
#     else:
#         tag = f"<p>Unsupported file type: {filename}</p>"

#     return f"""
#     <html>
#       <head>
#         <title>View Media: {filename}</title>
#       </head>
#       <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
#         {tag}
#       </body>
#     </html>
#     """


# Not used for now but is available anyway
# @app.get("/media-list", response_class=HTMLResponse)
# async def list_media():
#     files = os.listdir(UPLOAD_DIR)
#     files.sort(reverse=True)

#     items = ""
#     for file in files:
#         lower = file.lower()
#         if lower.endswith((".jpg", ".jpeg", ".png", ".gif")):
#             items += f"""
#                 <div style="margin: 20px; text-align: center;">
#                     <img src="/media/{file}" style="max-width: 300px;"><br>
#                     <button onclick="displayMedia('{file}')">Display on Temi</button>
#                 </div>
#             """
#         elif lower.endswith((".mp4", ".webm")):
#             items += f"""
#                 <div style="margin: 20px; text-align: center;">
#                     <video src="/media/{file}" controls style="max-width: 300px;"></video><br>
#                     <button onclick="displayMedia('{file}')">Display on Temi</button>
#                 </div>
#             """

#     return f"""
#     <html>
#     <head>
#         <title>Media List</title>
#     </head>
#     <body>
#         <h1>Uploaded Media</h1>
#         <div style="display: flex; flex-wrap: wrap;">
#             {items}
#         </div>
#         <script>
#         const socket = new WebSocket("ws://localhost:8000/control");

#         socket.onopen = () => console.log("Connected to WebSocket");
#         socket.onmessage = (event) => console.log("Received:", event.data);

#         function displayMedia(filename) {{
#             const message = {{
#                 command: "displayMedia",
#                 payload: filename
#             }};
#             socket.send(JSON.stringify(message));
#             alert("Sent displayMedia command for: " + filename);
#         }}
#         </script>
#     </body>
#     </html>
#     """

# @app.get("/api/media-list")
# async def get_media_list():
#     # files = os.listdir(UPLOAD_DIR)
#     # files.sort(reverse=True)

#     # media_files = []
#     # for file in files:
#     #     lower = file.lower()
#     #     if lower.endswith((".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm")):
#     #         media_files.append(file)

#     # return JSONResponse(content={"files": media_files})
#     try:
#         with open(MEDIA_INDEX_FILE, "r") as f:
#             lines = f.readlines()
#         media_files = [line.strip() for line in lines if line.strip()]
#     except FileNotFoundError:
#         media_files = []

#     return JSONResponse(content={"files": media_files})


@app.get("/avatars/")
def list_avatars():
    avatar_dir = "static/avatars"
    files = os.listdir(avatar_dir)
    return [f"/static/avatars/{file}" for file in files if file.lower().endswith((".png", ".jpg", ".jpeg"))]