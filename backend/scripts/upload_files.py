#!/usr/bin/python3

import os
import json
import datetime
import hashlib
import redis
import requests
import sys
from dotenv import load_dotenv

from box_sdk_gen import (
    BoxClient, BoxDeveloperTokenAuth,
    BoxCCGAuth, CCGConfig,
    CreateFolderParent,
    UploadFileAttributes,
    UploadFileAttributesParentField,
    UploadFileVersionAttributes,
    Files,
)

redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)


USER_HOME = os.path.expanduser("~")
dotenv_path = os.path.join(USER_HOME, 'temi-autonomous', 'backend', '.env')
load_dotenv(dotenv_path)


BASE_URL = os.environ.get('CLOUD_APP_BASE_URL')
USER_TOKEN = os.environ.get('CLOUD_APP_USER_TOKEN')
MAIN_FOLDER_ID = os.environ.get('BOX_MAIN_FOLDER_ID')
FAMILY_ID = os.environ.get('FAMILY_ID')
LOG_DIR = os.environ.get('LOG_DIR')
FOLDER_IDS = os.path.join(LOG_DIR, 'box_folder_ids.json')
UPLOADED_ITEMS_LOG = os.path.join(LOG_DIR, 'upload_items.log')
FILES_TO_UPLOAD = '/home/pi/files_to_upload'



def get_md5(file_path):
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()



def get_access_token():
    # get access token from cloud app
    url = f'{BASE_URL}/files/get_box_access_token/'
    headers = {
        'Authorization': f'Token {USER_TOKEN}'
    }
    payload = {
        'token_vendor': 'box',
        'token_type': 'access_token'
    }
    res = requests.post(url, headers=headers, json=payload, timeout=15)
    return res



def get_folder_ids(client):
    '''
    folder_id_map = {
        'participant_main': '274775519061',
    }
    '''
    folder_id_map = {}
    if os.path.isfile(FOLDER_IDS):
        with open(FOLDER_IDS) as f:
            folder_id_map = json.load(f)
    else:
        participant_folders = client.folders.get_folder_items(MAIN_FOLDER_ID).entries
        participant_folders = [x.name for x in participant_folders]
        if FAMILY_ID not in participant_folders:
            participant_folder = client.folders.create_folder(
                FAMILY_ID, CreateFolderParent(id=MAIN_FOLDER_ID))
            folder_id_map['participant_main'] = participant_folder.id
            with open(FOLDER_IDS, 'w') as f:
                json.dump(folder_id_map, f, indent=4)
    return folder_id_map


def update_file(filename, filepath, file_id, client):
    try:
        with open(filepath, 'rb') as up_file:
            res = client.uploads.upload_file_version(
                file_id,
                UploadFileVersionAttributes(name=filename),
                up_file,
            )
            if res.total_count != 1:
                print(f'[ERROR] updating: {filepath}')
                print(res)
                return -1
        with open(UPLOADED_ITEMS_LOG, 'a') as f:
            f.write(
                str(datetime.datetime.now()) + ';' +
                filepath + ';' +
                get_md5(filepath) + ';' +
                res.entries[0].id + 
                '\n'
            )
    except Exception as e:
        print(f'[ERROR] updating: {filepath}')
        print(e)
        return -1
    return 0


def upload_file(filename, filepath, folder_map, client):
    parent_dir = 'participant_main'
    attrs = UploadFileAttributes(
        name=filename,
        parent=UploadFileAttributesParentField(id=folder_map[parent_dir])
    )
    # TODO: Maybe do preflight check
    try:
        with open(filepath, 'rb') as up_file:
            res = client.uploads.upload_file(
                attributes=attrs, file=up_file
            )
            if res.total_count != 1:
                print(f'[ERROR] uploading: {filepath}')
                print(res)
                return -1
            # TODO: check return code?
        with open(UPLOADED_ITEMS_LOG, 'a') as f:
            f.write(
                str(datetime.datetime.now()) + ';' +
                filepath + ';' +
                get_md5(filepath) + ';' +
                res.entries[0].id + 
                '\n'
            )
    except Exception as e:
        print(f'[ERROR] uploading: {filepath}')
        print(e)
        return -1
    return 0


def main():
    print(BASE_URL)
    print(USER_TOKEN)
    print(MAIN_FOLDER_ID)
    print(FAMILY_ID)
    print(LOG_DIR)
    print(UPLOADED_ITEMS_LOG)
    print(FOLDER_IDS)

    if None in [BASE_URL, FAMILY_ID, USER_TOKEN, MAIN_FOLDER_ID]:
        print(f'[WARNING] Box vairables not set. Aborting.')
        sys.exit()

    retries = 5
    access_token = None
    while retries > 0 and access_token is None:
        try:
            res = get_access_token()
            access_token = res.json()['access_token']
            # access_token = 'WoJQqJIKmUpjyXw3mkKu8bqUrpNw2GIJ'
        except Exception as e:
            print(f'[ERROR] get_access_token: {e}')
        retries -= 1
        

    auth = BoxDeveloperTokenAuth(token=access_token)
    client = BoxClient(auth=auth)

    folder_id_map = get_folder_ids(client)

    uploaded_items = {}
    if os.path.isfile(UPLOADED_ITEMS_LOG):
        with open(UPLOADED_ITEMS_LOG, 'r') as f:
            # if same file is in there multiple times
            # -- latest one has the latest hash so we're good
            for line in f:
                timestamp, filename, hash, file_id = line.rstrip().split(';')
                uploaded_items[filename] = {
                    'hash': hash,
                    'file_id': file_id
                }

    skipped_count = 0
    uploaded_count = 0
    error_count = 0
    with open(FILES_TO_UPLOAD, 'r') as f:
        for filepath in f:
            filepath = filepath.strip()
            filename = filepath.split('/')[-1]
            if filepath not in uploaded_items:
                res = upload_file(filename, filepath, folder_id_map, client)
                if res == 0:
                    uploaded_count += 1
                else:
                    error_count += 1
            elif uploaded_items[filepath]['hash'] != get_md5(filepath):
                # uploaded before but content changed. Box requires file_id to process an update
                # only conversations might update here...
                res = update_file(filename, filepath, uploaded_items[filepath]['file_id'], client)
                if res == 0:
                    uploaded_count += 1
                else:
                    error_count += 1
            else:
                skipped_count += 1
        
    print(f'Uploaded: {uploaded_count}')
    print(f'Skipped: {skipped_count}')
    print(f'Error: {error_count}')

        # Other files
        # other_files = [
        #     'convo_log.txt', 'llm_full.log', 'llm_usage.log', 'profiling.log', 'usage_log.txt',
        #     'messages.json'
        # ]
        # for item in other_files:
        #     filepath = f'/var/log/misty_deploy/{item}'
        #     if filepath not in uploaded_items:
        #         # Upload to participant root
        #         res = upload_file(item, filepath, folder_id_map, client)
        #         if res == 0:
        #             uploaded_count += 1
        #         else:
        #             error_count += 1
        #     elif uploaded_items[filepath]['hash'] != get_md5(filepath):
        #         # uploaded before but content changed. Box requires file_id to process an update
        #         # only conversations might update here...
        #         res = update_file(item, filepath, uploaded_items[filepath]['file_id'], client)
        #         if res == 0:
        #             uploaded_count += 1
        #         else:
        #             error_count += 1
        #     else:
        #         skipped_count += 1

        # upload syslog with timestamp
        # now = datetime.datetime.now()
        # now_formatted = now.strftime('%Y-%m-%d__%H_%M_%S')
        # syslog_name = f'{now_formatted}__syslog.log'
        # syslog_path = '/var/log/syslog'
        # res = upload_file(syslog_name, syslog_path, folder_id_map, client)
        
        # if res == 0:
        #     uploaded_count += 1
        # else:
        #     error_count += 1


if __name__ == '__main__':
    main()



# filename = 'python3_1053_1720747951649.log'
# parent_dir = 'ROS'
# filepath = f'/var/log/misty_deploy/{parent_dir}/{filename}'
# upload_file(filename, filepath, parent_dir)


# filename = '2024-07-10_21-28-17_13960.wav'
# parent_dir = 'audio_records'
# filepath = f'{AUDIO_DIR}/{filename}'
# upload_file(filename, filepath, parent_dir)

