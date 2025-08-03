#!/usr/bin/python3

import redis
import requests
import datetime
import os
import psutil
import subprocess
import sys
import time
from dotenv import load_dotenv

# Slack app dependent
USER_HOME = os.path.expanduser("~")
dotenv_path = os.path.join(USER_HOME, 'temi-autonomous', 'backend', '.env')
load_dotenv(dotenv_path)


SLACK_WEBHOOK = os.environ.get('SLACK_WEBHOOK')
DEBUG = int(os.environ.get('DEBUG', 0))
PI_NAME = 'UNKNOWN'
try:
    with open('/etc/hostname') as f:
        PI_NAME = f.read().strip()
except Exception as e:
    print(f'[ERROR] Reading hostname: {e}')


redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)


def get_pi_status():
    report = ""
    data = {}
    for _key in redis_client.scan_iter("state:*"):
        v = redis_client.get(_key)
        data[_key] = v

    data['battery:charge_percent'] = redis_client.get('battery_percent')
    data['last_trigger_task'] = redis_client.get('last_trigger_task')
    data['current_location'] = redis_client.get('current_location')
    data['disk_usage'] = f"Used: {psutil.disk_usage('/').percent}%"

    for _key, v in data.items():
        report += f"- *{_key}*: {v}\n"

    # port on remote server
    v = redis_client.get('system:ssh_port')
    report += f"- *SSH_PORT*: {v}\n"
    return report


def post_to_slack(msg):
    url = SLACK_WEBHOOK
    title = 'Status Report'
    now = datetime.datetime.now()
    now_formatted = now.strftime('%Y-%m-%d %H:%M:%S')
    data = {
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"*=== [{now_formatted}] [{PI_NAME}] [{title}] ===*\n"
                        f"({os.environ.get('FAMILY_ID')})\n"
                    )
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": msg
                }
            }
        ]
    }
    res = requests.post(url, json=data)
    print(res.status_code)



if __name__ == '__main__':

    last_reported_time = redis_client.get('report:last_reported_time')
   
    if not last_reported_time:
        last_reported_time = 0
    time_lapsed = time.time() - float(last_reported_time)
    if time_lapsed < 60 * 60 - 15 and DEBUG == 0:
        print(f'Skipping Slack report: time_lapsed = {time_lapsed}')
        sys.exit()

    res = get_pi_status()
    post_to_slack(res)
    redis_client.set('report:last_reported_time', time.time())
    
    
