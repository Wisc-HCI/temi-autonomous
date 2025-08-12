import asyncio
import datetime
import os
from dotenv import load_dotenv
from openai import OpenAI
from openai import AsyncOpenAI
import json
import redis
import time
from redis import asyncio as aioredis
import random
from utils import save_message, check_weather


load_dotenv()

gpt_client = AsyncOpenAI()

REDIS_IP = os.environ.get('REDIS_IP')
# redis_client = redis.Redis(host=REDIS_IP, port=6379, db=0, decode_responses=True)
redis_client = aioredis.from_url("redis://localhost", decode_responses=True)


OPENAI_GPT_MODEL="gpt-4.1-mini-2025-04-14"
OPENAI_GPT_MODEL_LG="gpt-4.1-2025-04-14"


MAIN_PROMPT = '''
**YOUR ROLE**
You are a friendly, conversational social robot deployed to a family to help facilitate family routines by providing contextual reminders.

The only thing you are able to do is to provide information about the family's routines and tasks, tell jokes and fun facts, and have general conversations.

For example, you are NOT able to remind them again in X minutes, mute notifications, or perform any actual functions.



The family info:
{FAMILY_INFO}



{ROUTINES_INFO}



IF you are asked to tell a joke, a riddle, or anything entertaining, use this *seed topic* to generate the response:
{SEED}


**Current State**
The current state is: {STATE}


** Important **
Only ask follow-up questions if necessary.
If the user asks something, just answer it.
The only exception is asking for clarifications.
You are a conversational robot.
DO NOT offer to do anything that you are not capable of.




The latest USER input is: {COMMAND}.

In plain text, what is your response?
'''.strip() + '\n\n\n'






SYSTEM_PROMPT = '''
You are a helpful agent controlling a domestic social robot,
and your goal is to facilitate family routines via contextual reminders.
The transcriptions you are provided with may be from various people within the family.
'''




class LLMAgent:
    def __init__(self):
        self.scheduler = None
        self.last_proactive = time.time()

    async def get_current_messages(self):
        # redis_client.expire('current-msgs', MSG_EXPIRE)
        res = await redis_client.lrange('current-msgs', 0, -1)
        return res

    async def get_recent_messages(self):
        # not the most efficient but should be good enough for now
        res = await self.get_current_messages()
        context = []
        for msg in res:
            role, content = msg.split(':', 1)
            context.append(
                {'role': role, 'content': content.strip()}
            )
        return context

    def get_day_and_time(self):
        now = datetime.datetime.now()
        _date, _day, _time = now.strftime('%b %d %Y, %A, %I:%M%p').split(',')
        return (_date, _day.strip(), _time.strip())
    
    async def get_state_info(self):
        day_and_time = self.get_day_and_time()
        STATE = {
            'date': day_and_time[0],
            'time_of_day': day_and_time[2],
            'day_of_week': day_and_time[1],
        }

        weather = await check_weather()

        state_info = (
            'The current state is: \n' 
            f"Date: {STATE['date']}; \n"
            f"Time of day: {STATE['time_of_day']}; \n"
            f"Day of week: {STATE['day_of_week']}; \n"
            f"Weather: {weather}\n"
        )
        return state_info

    # def parse_json_response(self, json_res):
    #     try:
    #         start = json_res.find('{')
    #         end = json_res.rfind('}')
    #         if start == -1 or end == -1:
    #             raise json.decoder.JSONDecodeError(
    #                 "Invalid symbol: missing start or end", doc="", pos=0)
    #         if end < start:
    #             raise json.decoder.JSONDecodeError(
    #                 "Invalid range: end before start", doc="", pos=0)
    #         res = json.loads(json_res[start:end+1])
    #         return res
    #     except json.decoder.JSONDecodeError as e:
    #         print(f'[ERROR] Parsing response to JSON: {e.msg} — at pos {e.pos}')
    #         return None


    async def get_routine_task_info(self):
        res = "There are currently NO reminders or tasks available.\n\n"
        manual_tasks = self.scheduler.active_manual_triggers
        if manual_tasks:
            res = "The current active routines and reminders are:\n"
            now = datetime.datetime.now()
            current_date = now.strftime('%Y/%m/%d')
            all_tasks = self.scheduler.family_config_json[current_date]
            for name, tasks in manual_tasks.items():
                for task in tasks:
                    task_info = all_tasks.get(task, {}).get('description', "")
                    res += f"{name}: {task_info}\n"
            # switch between proactive and reactive
            prompt_version = "ONLY make use of these information **if** you are asked about routines or tasks."
            if time.time() - self.last_proactive > 10 * 60:
                prompt_version = "You should also proactively mention these during conversations."
                self.last_proactive = time.time()
            res += f"\n{prompt_version}\n\n"
        return res

    # async def respond_to_check_in(self, user_name):
    #     '''
    #     User presses their name on the screen as a check-in

    #     side-effects:
    #     For reminders provided, remember to
    #         - increment the count, set to inactive if necessary
    #         - update last triggered time
    #     '''
    #     pass

    async def generate_response(self, user_message):
        state_info = await self.get_state_info()
        # locations_info = await get_locations_info()
        # locations_info_str = ''
        # now = time.time()
        # for loc_item in locations_info:
        #     elapsed_minutes = int((now - loc_item['timestamp']) / 60)
        #     _item_str = f"{loc_item['location']}: {loc_item['context']}"
        #     _item_str += f" (last updated: {elapsed_minutes} minutes ago)\n"
        #     locations_info_str += _item_str

        routines_info = await self.get_routine_task_info()

        FAMILY_INFO_STR = ""
        if self.scheduler.family_config_json:
            for name, info in self.scheduler.family_config_json['family_members'].items():
                FAMILY_INFO_STR += f"{name}: {info}\n"

        msg_sys = {
            'role': 'system',
            'content': SYSTEM_PROMPT
        }
        
        seeds = [
            "banana", "toaster", "penguin", "socks", "bubble", "pillow", "robot", "chicken", "pirate", "cat",
            "dog", "hat", "cupcake", "spaghetti", "toothbrush", "turtle", "marshmallow", "unicorn", "donut", "snowman",
            "pickle", "dinosaur", "pencil", "sandwich", "frog", "spoon", "cookie", "cloud", "noodle", "monkey",
            "cheese", "balloon", "nap", "fart", "zebra", "milk", "crayon", "worm", "bee", "shoes",
            "book", "carrot", "giraffe", "chair", "sock", "apple", "mud", "sneeze", "popcorn", "toad",
            "lizard", "phone", "car", "ice cream", "drum", "dance", "candy", "watermelon", "robot", "goose",
            "jelly", "jellyfish", "superhero", "pajamas", "kite", "robot", "wiggle", "moon", "toes", "school bus",
            "glue", "blanket", "mirror", "bathtub", "snail", "yogurt", "wig", "slipper", "snore", "crab",
            "rainbow", "whistle", "alarm", "goblin", "kangaroo", "elbow", "quack", "tickle", "grapes", "tissue",
            "bunny", "puddle", "broom", "bubblegum", "truck", "leg", "sneeze", "scooter", "cow", "nose",
            "bat", "pencil case", "sock puppet", "lunchbox", "duck", "glasses", "moonwalk", "suitcase", "robot", "zoo",
            "rocket", "swing", "puzzle", "hamburger", "dragon", "spider", "ghost", "magic", "beard", "chalk",
            "suit", "slide", "banana peel", "ice cube", "marble", "trombone", "tent", "skunk", "catfish", "shoelace",
            "fan", "trophy", "window", "backpack", "nugget", "owl", "mittens", "maraca", "bubble wrap", "airplane",
            "ladybug", "clown", "grass", "firetruck", "popsicle", "scooter", "helicopter", "glove", "button", "sponge",
            "key", "fuzzy", "snowball", "raccoon", "thumb", "ball", "cloud", "cookie jar", "milkshake", "cup",
            "robot dance", "slinky", "tentacle", "lipstick", "barn", "whiskers", "gravy", "pencil sharpener", "comb", "fish tank",
            "tooth", "bookmark", "tail", "bicycle", "sticker", "quilt", "swing set", "paint", "glitter", "volcano",
            "igloo", "wiggle worm", "mop", "button nose", "bubble beard", "cup of soup", "sock hat", "funny face", "tiny shoes", "pogo stick",
            "ear", "paperclip", "desk", "radio", "gum", "mailbox", "jelly bean", "yo-yo", "hamster", "taco",
            "crayon box", "pencil eraser", "remote", "grumpy cat", "sandcastle", "gummy bear", "fizzy drink", "pet rock", "super nose", "flying pig",
            "spooky noise", "melting ice cream", "soggy sandwich", "itchy sweater", "mud puddle", "orange juice", "bouncing ball", "sticky note", "purple giraffe", "chewy candy",
            "noisy parrot", "toy robot", "funny laugh", "roller skates", "clumsy wizard", "squeaky toy", "blueberry pie", "crazy hair", "mystery sock", "bouncy bed",
            "trampoline", "alarm clock", "lost mitten", "jumpy frog", "laughing baby", "tangled hair", "wobbly chair", "giant cookie", "talking dog", "tiny dragon",
            "wacky dance", "super sneeze", "backwards hat", "painted nose", "silly rule", "magic banana", "glowing shoes", "bubble parade", "rattling box", "fluffy monster",
            "wacky dream", "secret handshake", "goofy grin", "noisy closet", "flying shoe", "talking fish", "silly face", "tiny trumpet", "tooth fairy", "bouncing marshmallow",
            "giggling ghost", "confused robot", "sticky pancake", "chocolate lake", "crazy bus", "jiggly jelly", "tiny knight", "flip-flops", "ticklish bear", "hairbrush hero",
            "fizzy apple", "wiggly spaghetti", "paint fight", "spilled juice", "secret tunnel", "dizzy cat", "noodle hat", "couch fort", "cartwheel", "banana phone"
        ]
        seed = random.choice(seeds)

        prompt = MAIN_PROMPT.format(
            FAMILY_INFO=FAMILY_INFO_STR,
            COMMAND=user_message,
            STATE=state_info,
            ROUTINES_INFO=routines_info,
            # ENVIRONMENT_INFO=locations_info_str,
            SEED=seed
        )

        print(prompt)

        msg_last = {
            'role': 'user',
            'content': prompt
        }

        msg_hist = await self.get_recent_messages()
        messages = [msg_sys] + msg_hist + [msg_last]
        res = ''
        try:
            ans = await gpt_client.chat.completions.create(
                model=OPENAI_GPT_MODEL,
                max_completion_tokens=256,
                stop="\n\n\n",
                messages=messages,
                temperature=1,
                top_p=1,
                n=1,
            )

            res = ans.choices[0].message.content
            token_output = ans.usage.completion_tokens
        except Exception as e:
            print(f'[ERROR][generate_response]: {e}')
            res = "Sorry I didn't get that, can you say that again?"

        # update redis message history
        await save_message('user', user_message)
        # await asyncio.to_thread(save_message, 'user', user_message)
        if res:
            await save_message('assistant', res)
            # await asyncio.to_thread(save_message, 'assistant', res)
        return res




