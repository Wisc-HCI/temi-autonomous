import datetime
import os
import time
import json
from functools import lru_cache
from dotenv import load_dotenv
import redis
from redis import asyncio as aioredis
import requests


load_dotenv()
REDIS_IP = os.environ.get('REDIS_IP')
# redis_client = redis.Redis(host=REDIS_IP, port=6379, db=0, decode_responses=True)
redis_client = aioredis.from_url("redis://localhost", decode_responses=True)

LOG_DIR = os.environ.get('LOG_DIR')
LOG_FILE = os.path.join(LOG_DIR, "log.log")
CONVO_LOG = os.path.join(LOG_DIR, "conversation.log")


# @lru_cache(maxsize=1)
# def get_zoom_jwt():
#     print("get_zoom_jwt called!")
#     print(ZOOM_SESSION_NAME)
#     # Set JWT payload
#     iat = int(time.time())
#     # Token valid for 24 hours
#     exp = iat + 24 * 60 * 60

#     payload = {
#         "app_key": ZOOM_SDK_KEY,  # SDK Key
#         "iat": iat,               # Issued at
#         "exp": exp,               # Expiration
#         "tpc": ZOOM_SESSION_NAME,     # Unique session name (Topic)
#         "role_type": 1,              # host/co-host
#         "version": 1,

#     }

#     # Generate token
#     token = jwt.encode(payload, ZOOM_SDK_SECRET, algorithm="HS256")
#     print("Zoom Video SDK JWT:")
#     print(token)
#     return token, exp


def log_event(direction: str, path: str, data: str):
    # skip these:
    if (direction == 'received' and
        path == '/control' and
        'zoom_status' in data):
        return

    if (direction == 'sent' and
        path == '/control' and
        'zoom_status' in data and
        "'call_duration': None" in data):
        return

    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, 'a') as f:
        f.write(f"[{timestamp}][{direction}][{path}] {data}\n")


async def save_message(speaker_role, message):
    # for now keep 80 messages in redis
    now = datetime.datetime.now()
    now_str = now.strftime('%b %d %Y, %A, %I:%M%p')
    msg_format = f'{speaker_role}: [{now_str}] {message}'
    await redis_client.rpush('current-msgs', msg_format)
    await redis_client.ltrim('current-msgs', -80, -1)
    if CONVO_LOG:
        with open(CONVO_LOG, "a") as f:
            f.write(msg_format + '\n')


async def check_weather():
    res = await redis_client.get('cache:weather_info')
    if res is not None:
        print('[check_weather] USING CACHE!')
        return res
    
    print('[check_weather] RUNNING!')
    madison_url = 'https://api.weather.gov/gridpoints/MKX/38,64/forecast'
    headers = {
        "User-Agent": "RobotWeather (mxu339@wisc.edu)"
    }
    weather_str = ''
    try:
        forecast_response = requests.get(madison_url, headers=headers, timeout=2)
        forecast_data = forecast_response.json()
        weather_str = ''
        weather_now = forecast_data['properties']['periods'][0]
        weather_next = forecast_data['properties']['periods'][1]
        weather_str += f"{weather_now['name']}: {weather_now['detailedForecast']}\n"
        weather_str += f"{weather_next['name']}: {weather_next['detailedForecast']}"
        await redis_client.setex(
            'cache:weather_info',
            60 * 60 * 3,
            weather_str
        )
    except Exception as e:
        print(f'[check_weather] ERROR: {str(e)}')
    return weather_str


async def get_locations_info():
    pattern = "location:*"
    keys = [key async for key in redis_client.scan_iter(match=pattern)]
    
    if not keys:
        return []

    json_strings = await redis_client.mget(*keys)

    results = []
    for key, js in zip(keys, json_strings):
        if js:
            try:
                parsed = json.loads(js)
                parsed["location"] = key
                results.append(parsed)
            except json.JSONDecodeError:
                print(f"Could not parse JSON for key: {key}")
    return results
