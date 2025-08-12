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
from ultralytics import YOLO
from utils import log_image_analysis, log_key_event

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

# location_reminder = family_config_json.get("location_reminder", [])




# YOLO stuff
# YOLO_MODEL = 'yolo11n.pt'
# yolo_model = YOLO(YOLO_MODEL, task='detect')
YOLO_MODEL = 'yolo11n_openvino_model'
yolo_model = YOLO(YOLO_MODEL, task='detect')
obj_dict = {
    0: 'person', 1: 'bicycle', 2: 'car', 3: 'motorcycle', 4: 'airplane', 5: 'bus',
    6: 'train', 7: 'truck', 8: 'boat', 9: 'traffic light', 10: 'fire hydrant', 
    11: 'stop sign', 12: 'parking meter', 13: 'bench', 14: 'bird', 15: 'cat',
    16: 'dog', 17: 'horse', 18: 'sheep', 19: 'cow', 20: 'elephant', 21: 'bear',
    22: 'zebra', 23: 'giraffe', 24: 'backpack', 25: 'umbrella', 26: 'handbag',
    27: 'tie', 28: 'suitcase', 29: 'frisbee', 30: 'skis', 31: 'snowboard',
    32: 'sports ball', 33: 'kite', 34: 'baseball bat', 35: 'baseball glove',
    36: 'skateboard', 37: 'surfboard', 38: 'tennis racket', 39: 'bottle',
    40: 'wine glass', 41: 'cup', 42: 'fork', 43: 'knife', 44: 'spoon', 45: 'bowl',
    46: 'banana', 47: 'apple', 48: 'sandwich', 49: 'orange', 50: 'broccoli',
    51: 'carrot', 52: 'hot dog', 53: 'pizza', 54: 'donut', 55: 'cake', 56: 'chair',
    57: 'couch', 58: 'potted plant', 59: 'bed', 60: 'dining table', 61: 'toilet',
    62: 'tv', 63: 'laptop', 64: 'mouse', 65: 'remote', 66: 'keyboard', 67: 'cell phone',
    68: 'microwave', 69: 'oven', 70: 'toaster', 71: 'sink', 72: 'refrigerator',
    73: 'book', 74: 'clock', 75: 'vase', 76: 'scissors', 77: 'teddy bear',
    78: 'hair drier', 79: 'toothbrush'
}








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
Analyze the image and describe if the following conditions are present in the image.

Conditions to check for:
{REMINDER_CONTEXT}

Format:
condition name: condition description.


For each condition, return a true or false value, depending on if the condition is detected.

You should provide a response in JSON format, like in this example

{{
    "<condition-name>": true / false,
    "<condition-name>": true / false,
    "<condition-name>": true / false
}}


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




def check_image_for_reminders(filename, reminder_context):
    prompt = REMINDER_ANALYSIS_PROMPT.format(
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
        temperature=0.1,
        top_p=1,
        n=1,
        response_format={"type": "json_object"},
    )
    print(f'Usage: {ans.usage}')
    print('check_image_for_reminders', time.time() - start)

    res = ans.choices[0].message.content
    res = parse_json_response(res)
    print(f'[check_image_for_reminders] Analysis result: \n{res}')
    return res




def check_image_for_persons(filename):
    # filepath = "C:\\Users\\xurub\\git_repos\\temi-woz\\backend\\participant_data\\archive\\JPEG_20250620_142613_6751575767030221795.jpg"
    # res = yolo_model.predict(filepath, save=True, conf=0.5)
    filepath = os.path.join(UPLOAD_DIR, filename)
    # Can set save=True for debug --> output image with bounding boxes
    res = yolo_model.predict(filepath, save=False, conf=0.6)
    frame_labels = set([int(x) for x in res[0].boxes.cls.tolist()])
    # 0 is index for persons
    return 0 in frame_labels





def process_image(job):
    redis_client.set('status', 'processing')
    redis_client.set('status_updated', int(time.time()))
    print(f"Processing: {job}")
    # data = {
    #     "filename": message['filename'],
    #     "task_names": "detect_people",
    #     "request_id": message['request_id'],
    #     "position": request_context['position'],
    #     "location": request_context['location']
    # }

    result_json = {
        'job': job
    }

    now = datetime.datetime.now()
    current_date = now.strftime('%Y/%m/%d')
    task_names = job['task_names']
    all_tasks = family_config_json.get(current_date, {})
    family_descriptions = family_config_json.get('family_members', {})
    location = job['location']

    # check if any people in the picture
    has_person = check_image_for_persons(
        job['filename'],
    )
    result_json['has_person'] = has_person

    has_secondary_task = False
    for task in task_names:
        redis_client.set(f"last_checked:{task}:{location}", str(int(time.time())))
        if task == 'secondary-task':
            has_secondary_task = True

    if has_secondary_task:
        secondary_task = redis_client.get('secondary_task')
        if secondary_task:
            secondary_task = json.loads(secondary_task)
            all_tasks['secondary-task'] = secondary_task

    check_no_person = False
    for task in task_names:
        vision_trigger = all_tasks.get(task, {}).get('vision_trigger', '')
        print(f'Task {task}: {vision_trigger}')
        word_check = vision_trigger.lower()
        if (
            '-description>' not in word_check and
            'person' not in word_check and
            'anyone' not in word_check and
            'people' not in word_check
        ):
            check_no_person = True
            break

    res_has_people = {}
    res_context = {}
    if has_person or check_no_person:
        reminder_context = ''
        for task in task_names:
            vision_trigger = all_tasks.get(task, {}).get('vision_trigger')
            if vision_trigger:
                if vision_trigger == '<anyone>':
                    res_has_people[task] = True
                    continue
                # replace user description placeholders
                for name, desc in family_descriptions.items():
                    vision_trigger = vision_trigger.replace(f'<{name.lower()}-description>', desc)
                reminder_context += task + ': ' + vision_trigger + ';\n'
        if reminder_context:
            print('Analyzing images with remidner context:')
            print(reminder_context)
            res_context = check_image_for_reminders(
                job['filename'],
                reminder_context
            )
            result_json['reminders_status'] = res_context
            if res_context is None:
                print('Error analyzing image. Likely invalid format from openai.')
                res_context = {}
            
        print(res_has_people)
        print(res_context)
        res = res_context | res_has_people
        print(res)

        now = int(time.time())
        now_str = str(now)
        for task in task_names:
            trigger_bool = res.get(task, None)
            print(f'task: {task}; trigger_bool: {trigger_bool}')
            duration_trigger = all_tasks.get(task, {}).get('duration_trigger')
            if trigger_bool is True:
                result_json['has_trigger'] = True
                log_key_event('trigger_true', f'{location};{task}')
                if duration_trigger:
                    # These are for triggers that depend on certain durations of activities
                    redis_client.set(f"{task}:true:location", location)
                    ZSET_KEY = f"{task}:true"
                    redis_client.zadd(ZSET_KEY, {now_str: now})
                    cutoff = now - 15 * 60
                    redis_client.zremrangebyscore(ZSET_KEY, 0, cutoff)
                    earliest_entry = redis_client.zrange(ZSET_KEY, 0, 0, withscores=True)
                    earliest_timestamp = int(earliest_entry[0][1])
                    if now - earliest_timestamp > duration_trigger:
                        print(f'Adding {task} to robot action queue')
                        result_json['intention_for_action'] = True
                        log_key_event('intention_for_action', f'{location};{task}')
                        redis_client.rpush('robot_action', task)
                else:
                    print(f'Adding {task} to robot action queue')
                    log_key_event('intention_for_action', f'{location};{task}')
                    result_json['intention_for_action'] = True
                    redis_client.rpush('robot_action', task)
            elif trigger_bool is False:
                if duration_trigger:
                    prev_location = redis_client.get(f"{task}:true:location")
                    if prev_location == location:
                        redis_client.delete(f"{task}:true:location")
            else:
                print(f"{task} not in result.")

    else:
        for task in task_names:
            duration_trigger = all_tasks.get(task, {}).get('duration_trigger')
            if duration_trigger:
                prev_location = redis_client.get(f"{task}:true:location")
                if prev_location == location:
                    redis_client.delete(f"{task}:true:location")
                
            
            # formatted_time = datetime.datetime.now().strftime("%Y/%m/%d %I:%M%p")
            # # store result on redis
            # res = {
            #     "timestamp": int(time.time()),
            #     "formatted_time": formatted_time,
            #     "context": context,
            # }

            # print('Saving result')
            # print(res)
            # redis_client.set(f"location:{location}", json.dumps(res))
    log_image_analysis(job['filename'], result_json)
    redis_client.set('status', 'idle')
    redis_client.set('status_updated', int(time.time()))

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



