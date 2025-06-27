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



def main():
    redis_client = redis.Redis(host=REDIS_IP, port=6379, db=0, decode_responses=True)
    redis_client.set('Hi', 'Ho')
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



