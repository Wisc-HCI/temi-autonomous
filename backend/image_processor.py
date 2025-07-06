import datetime
import redis
# from redis import asyncio as aioredis
import json
import time
import os
from openai import OpenAI
import base64
import mimetypes
import signal
from dotenv import load_dotenv


load_dotenv()


# REDIS_IP = os.environ.get('REDIS_IP')
redis_client = redis.Redis(host=None, decode_responses=True)
# redis_client = aioredis.from_url("redis://localhost", decode_responses=True)

gpt_client = OpenAI()

family_config_file = os.environ.get('FAMILY_CONFIG_PATH')
UPLOAD_DIR = os.environ.get('UPLOAD_DIR')

OPENAI_GPT_MODEL="gpt-4.1-mini-2025-04-14"
OPENAI_GPT_MODEL_LG="gpt-4.1-2025-04-14"


with open(family_config_file, 'r') as f:
    family_config_json = json.load(f)

location_reminder = family_config_json.get("location_reminder", [])



running = True
def handle_sigterm(signum, frame):
    global running
    running = False
    print("Stopping gracefully...")


signal.signal(signal.SIGTERM, handle_sigterm)



def get_base64_data_uri(filepath):
    mime_type = "image/jpeg"
    with open(filepath, "rb") as f:
        file_bytes = f.read()

    encoded = base64.b64encode(file_bytes).decode('utf-8')
    data_uri = f"data:{mime_type};base64,{encoded}"
    return data_uri




REMINDER_ANALYSIS_PROMPT = '''
Analyze the image and describe what chores or tasks or reminders may be appropriate, given the context provided for where the image was taken.

Image location: {LOCATION}

Context for the reminder and location: {REMINDER_CONTEXT}

Only give reminders that are relevant to what’s visible in the image and provided in the context.

You should provide a response in JSON format, like in this example

{{
    "has_reminder": true / false,
    "task_or_action": "The dishes need to be washed."
}}

If there is nothing relevant to remind, return "fasle" for "has_reminder", and disregard the field "task_or_action".
Otherwise, "task_or_action" should describe what the family should do.


# solution in json:
'''.strip() + '\n\n\n'



def parse_json_response(json_res):
    try:
        start = json_res.find('{')
        end = json_res.rfind('}')
        if start == -1 or end == -1:
            raise json.decoder.JSONDecodeError(
                "Invalid symbol: missing start or end", doc="", pos=0)
        if end < start:
            raise json.decoder.JSONDecodeError(
                "Invalid range: end before start", doc="", pos=0)
        res = json.loads(json_res[start:end+1])
        return res
    except json.decoder.JSONDecodeError as e:
        print(f'[ERROR] Parsing response to JSON: {e.msg} — at pos {e.pos}')
        return None




def check_image_for_reminders(filename, location, reminder_context):
    prompt = REMINDER_ANALYSIS_PROMPT.format(
        LOCATION=location,
        REMINDER_CONTEXT=reminder_context
    )
    filepath = os.path.join(UPLOAD_DIR, filename)
    file_data_uri = get_base64_data_uri(filepath)
    msg_last = {
        'role': 'user',
        "content": [
            {"type": "text", "text": prompt},
            {
                "type":"image_url",
                "image_url":{
                    "url":file_data_uri,
                }
            }
        ],
    }
    start = time.time()
    messages = [msg_last]
    ans = gpt_client.chat.completions.create(
        model=OPENAI_GPT_MODEL,
        max_completion_tokens=256,
        stop="\n\n\n",
        messages=messages,
        temperature=0.2,
        top_p=1,
        n=1,
        response_format={"type": "json_object"},
    )
    print(f'Usage: {ans.usage}')
    print('check_image_for_reminders', time.time() - start)

    res = ans.choices[0].message.content
    token_output = ans.usage.completion_tokens
    res = parse_json_response(res)
    print(f'[check_image_for_reminders] Analysis result: \n{res}')
    return res




def process_image(job):
    print(f"Processing: {job}")
    # data = {
    #     "filename": message['filename'],
    #     "task": "detect_people",
    #     "request_id": message['request_id'],
    #     "position": request_context['position'],
    #     "location": request_context['location']
    # }

    if job['task'] == "check_if_reminder":
        location = job['location']
        reminder_context = location_reminder.get(location)
        if reminder_context:
            res = check_image_for_reminders(
                job['filename'],
                location,
                reminder_context
            )
            if res is None:
                return
            if res.get('has_reminder', False) is False:
                context = 'None'
            else:
                context = res.get('task_or_action', 'None')

            formatted_time = datetime.datetime.now().strftime("%Y/%m/%d %I:%M%p")
            # store result on redis
            res = {
                "timestamp": int(time.time()),
                "formatted_time": formatted_time,
                "context": context,
            }

            print('Saving result')
            print(res)
            redis_client.set(f"location:{location}", json.dumps(res))

    # TODO: Log these results



def main():
    while running:
        _, raw = redis_client.blpop("image_queue")
        job = json.loads(raw)
        process_image(job)


if __name__ == "__main__":
    main()



"""
Takes in an image from a queue, process it, and return results to 



# enqueue
job = {
    "path": "/images/img_123.jpg",
    "request_id": "abc123",
    "process": "yolo",
    "extra": {"save_annotated": True}
}
r.lpush("image_queue", json.dumps(job))



# worker
_, raw = r.brpop("image_queue")
job = json.loads(raw)
if job["process"] == "yolo":
    run_yolo(job["path"])
elif job["process"] == "openai":
    upload_to_openai(job["path"])




"""



