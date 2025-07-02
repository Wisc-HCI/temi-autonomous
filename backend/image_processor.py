import datetime
import redis
import json
import time
import os
import signal
from dotenv import load_dotenv

load_dotenv()

running = True
REDIS_IP = os.environ.get('REDIS_IP')


def handle_sigterm(signum, frame):
    global running
    running = False
    print("Stopping gracefully...")


signal.signal(signal.SIGTERM, handle_sigterm)



def process_image(job):
    print(f"Processing: {job}")
    time.sleep(1)  # Replace with real work!
    # data = {
    #     "image_path": message['path'],
    #     "task": "detect_people",
    #     "request_id": message['request_id'],
    #     "position": request_context['position'],
    #     "location": request_context['location']
    # }

    # context = ...


    context = "This is the contex!"
    formatted_time = datetime.datetime.now().strftime("%Y/%m/%d %I:%M%p")

    # store result on redis
    res = {
        "timestamp": int(time.time()),
        "formatted_time": formatted_time,
        "context": context,
    }

    print('Saving result')
    print(res)
    if job.get('location'):
        redis_client.set('location:{location}', json.dumps(res))



def main():
    redis_client = redis.Redis(host=REDIS_IP, port=6379, db=0, decode_responses=True)
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



