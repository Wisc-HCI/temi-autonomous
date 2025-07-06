```
# Python 3.12.8
# create a virtualenv
python -m venv env

# (windows) activate it
./env/Scripts/activate

# install required packages
pip install -r requirements.txt
```


#### .env file
```
# create a .env file in the `backend` dir, and add these
FAMILY_INFO_STR=""
OPENAI_API_KEY="sk-W9...g13Tm1h"
FAMILY_CONFIG_PATH=""
FAMILY_CONFIG_PATH="C:\\git_projects\\temi-autonomous\\backend\\family_config.json"
UPLOAD_DIR="C:\\git_projects\\temi-autonomous\\backend\\participant_data\\media"
LOG_DIR="C:\\git_projects\\temi-autonomous\\backend\\participant_data"
```


#### To run the backend app
```
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```


```
Temi App
 ├── WebSocket -> control server (text commands, state updates)
 └── HTTP GET/POST -> media server (photo/video uploads/display)

Media Server (e.g. FastAPI)
 ├── POST /upload
 └── GET  /view/<filename>

WebSocket Server
 ├── Handles commands and chat
 └── Not burdened by large media transfers

```