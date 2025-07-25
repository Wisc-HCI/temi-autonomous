import { useEffect, useState } from "react";
import { connectWebSocket, sendMessageWS } from "../utils/ws";
import MediaList from '../components/MediaList';
import { useGamepadControls } from "../utils/useGamepadControls";
import presetPhrases from "../utils/presetPhrases";

const WizardPage = () => {

  const [log, setLog] = useState([]);
  const [inputText, setInputText] = useState("");
  const [pressedButtons, setPressedButtons] = useState([]);
  const [screenshotData, setScreenshotData] = useState(null)
  const [screenshotSource, setScreenshotSource] = useState("temi");
  const [snapshotData, setSnapshotData] = useState(null)
  const [lastSnapshotTime, setLastSnapshotTime] = useState(null);
  const [secondsSinceSnapshot, setSecondsSinceSnapshot] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [behaviorMode, setBehaviorMode] = useState(null);
  const [uploadNotification, setUploadNotification] = useState(null);
  const [notification, setNotification] = useState(null);
  const [notificationType, setNotificationType] = useState("warning");
  const [latestUploadedFile, setLatestUploadedFile] = useState(null);
  const [displayedMedia, setDisplayedMedia] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [canActivateCamera, setCanActivateCamera] = useState(true);
  const [canTakePicture, setCanTakePicture] = useState(false);
  const [canStartVideo, setCanStartVideo] = useState(false);
  const [canStopVideo, setCanStopVideo] = useState(false);
  const [startTime, setStartTime] = useState(null); // timestamp in ms
  const [now, setNow] = useState(null);
  const [timerActive, setTimerActive] = useState(false);

  const sendMessage = (message) => {
    sendMessageWS(message);
    if (message.command === "displayMedia") {
      setDisplayedMedia(message.payload);
    } else if (message.command === "displayFace") {
      setDisplayedMedia(null);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastSnapshotTime) {
        const diff = Math.floor((Date.now() - lastSnapshotTime) / 1000);
        setSecondsSinceSnapshot(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSnapshotTime]);

  useEffect(() => {
    const onWsMessage = (data) => {
      console.log('onWsMessage')
      console.log(data)
      if (data.type === 'asr_result') {
        setLog((prev) => [...prev, `Received: ${data.data}`]);
      } else if (data.type === 'suggested_response') {
        setInputText(data.data);
      } else if (data.type === "initial_status") {
        setBehaviorMode(data.data.behavior_mode);
        setDisplayedMedia(data.data.last_displayed);
      } else if (data.type === "behavior_mode") {
        setBehaviorMode(data.data);
      } else if (data.type === "media_uploaded") {
        if (data.data === 'silent') {
          setTimeout(() => {
            // for this setup, all media is uploaded after capture,
            // and the camera needs to / can be reopened afterwards
            // (a more rigorous imple. would be to listen to "share/dont share")
            setCanActivateCamera(true);
          }, 10000);
        } else {
          const msg = `✅ Media uploaded: ${data.filename}`;
          setUploadNotification(msg);
          setLatestUploadedFile(data.filename); 
          setTimeout(() => {
            setUploadNotification(null);
          }, 3000);
        }
      } else if (data.type === "saved_locations") {
        const locationList = data.data;
        setSavedLocations(locationList);
      } else if (data.type === "screenshot") {
        setScreenshotData(
          `data:image/jpeg;base64,${data.data}`
        );
      } else if (data.type === "snapshot") {
        setSnapshotData(
          `data:image/jpeg;base64,${data.data}`
        );
        setLastSnapshotTime(Date.now());
      } else if (data.type == "video_recording") {
        if (data.data === 'started') {
          setCanStopVideo(true)
        } else {
          setCanStopVideo(false)
        }
      } else if (data.type == "camera") {
        if (data.data === 'ready') {
          setCanTakePicture(true);
          setCanStartVideo(true);
        }
      } else if (data.type == "initiate_capture") {
        // TODO: TEST flow --> tablet initiate a request, and robot should activate camera immediately
        setCanActivateCamera(false);
        setNotification(`You're up! Tablet requested a ${data.data} from the robot. Go do it! Camera is activated for you already!`)
      }
    }
    connectWebSocket(onWsMessage, "control");
  }, []);

  useGamepadControls(sendMessage, setPressedButtons);

  useEffect(() => {
    if (!timerActive) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 2000);

    return () => clearInterval(interval);
  }, [timerActive]);






  function chunkArray(arr, chunkSize) {
    return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
      arr.slice(i * chunkSize, i * chunkSize + chunkSize)
    );
  }

  const navButtonsBlock = () => {
    if (savedLocations.length === 0) {
      return (
        <div className="row my-2">
          <div className="col-sm-6">
            <button
              className="btn btn-warning w-100"
              onClick={() =>
                sendMessage({ command: "queryLocations", payload: "" })
              }
            >
              Get Locations
            </button>
          </div>
        </div>
      )
    }

    const buttonChunks = chunkArray(savedLocations, 3);
    return (
      <div>
        {buttonChunks.map((row, rowIndex) => (
          <div className="row mb-2" key={rowIndex}>
            {row.map((loc, colIndex) => (
              <div className="col-sm-4" key={colIndex}>
                <button
                  className="btn btn-primary w-100"
                  onClick={() =>
                    sendMessage({ command: "goTo", payload: loc })
                  }
                >
                  {loc}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const getModeText = () => {
    if (behaviorMode === null) {
      return ' --- '
    } else if (behaviorMode === 'reactive') {
      return 'User Init. (reactive)';
    } else if (behaviorMode === 'proactive') {
      return 'Robot Init. (proactive)';
    }
  }

  const getCounterDiv = () => {

    const elapsed = startTime && now ? Math.floor((now - startTime) / 1000) : 0;
    const formattedTime = new Date(elapsed * 1000).toISOString().substr(11, 8);

    return (
      <div className="d-flex align-items-center text-white">
        <span className="fw-bold mr-3">
          {formattedTime}
        </span>
        <button
          className="btn btn-sm btn-success me-2"
          onClick={() => {
            if (!startTime) setStartTime(Date.now());
            setNow(Date.now());
            setTimerActive(true);
          }}
          disabled={timerActive}
        >
          Start
        </button>
        <button
          className="btn btn-sm btn-warning me-2"
          onClick={() => setTimerActive(false)}
          disabled={!timerActive}
        >
          Pause
        </button>
        <button
          className="btn btn-sm btn-danger me-2"
          onClick={() => {
            setTimerActive(false);
            setStartTime(null);
            setNow(null);
          }}
        >
          Reset
        </button>
        <input
          type="number"
          min="0"
          placeholder="Start at"
          className="form-control form-control-sm me-2"
          style={{ width: "80px" }}
          onChange={(e) => {
            const offset = parseInt(e.target.value, 10) || 0;
            setStartTime(Date.now() - offset * 1000);
            setNow(Date.now());
          }}
          disabled={timerActive}
        />
      </div>
    )
  }

  
  return (
    <div className="container-fluid p-0">
      <nav className="navbar navbar-dark bg-dark fixed-top">
        <span className="navbar-brand mb-0 h1">🤖 Wizard Control Dashboard</span>

        {getCounterDiv()}

      </nav>

      {uploadNotification && (
        <div
          className="alert alert-success position-fixed bottom-0 start-50 translate-middle-x mb-3 shadow"
          role="alert"
          style={{ zIndex: 1050 }}
        >
          {uploadNotification}
        </div>
      )}

      {notification && (
        <div
            className={`position-fixed bottom-50 start-50 translate-middle-x
              shadow align-items-center text-center
              alert alert-success alert alert-${notificationType}`}
            style={{
              zIndex: 1050, minWidth: "200px", minHeight: "120px"
            }}
          >
          <div className="my-3">
            {notification}
          </div>
          <button
              className="btn btn-secondary mt-3"
              onClick={() => setNotification(null)}>
            Got it!
          </button>
        </div>
      )}

      {modalData && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setModalData(null)}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-body text-center p-0 bg-black">
                <img
                  src={modalData}
                  alt="Screen Shot"
                  className="img-fluid"
                />
              </div>
              <div className="modal-footer justify-content-center">
                <button className="btn btn-secondary" onClick={() => setModalData(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container-fluid main-content mt-5 pt-2">
        <div className="row">
          {/* Control Panel */}
          <div className="col-md-4">
            <h4>Message Log</h4>
            <div
              className="border bg-light p-2 mt-2"
              style={{ height: "200px", overflowY: "auto", fontSize: "0.9rem" }}
            >
              {log.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>

            <div className="mb-2">
              <select
                className="form-select"
                onChange={(e) => setInputText(e.target.value)}
                value=""
              >
                <option value="" disabled>Pick a phrase...</option>
                {presetPhrases.map((phrase, index) => (
                  <option key={index} value={phrase}>
                    {phrase}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group mt-2">
              <textarea
                rows={3}
                className="form-control"
                placeholder="Enter text for robot to speak..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={!inputText.trim()}
                onClick={() => {
                  if (inputText.trim() !== "") {
                    sendMessage({
                      command: "speak",
                      payload: inputText.trim()
                    });
                    setLog((prev) => [...prev, `Sent: ${inputText.trim()}`]);
                    setInputText(""); // Clear input
                  }
                }}
              >
                Play on Robot
              </button>
            </div>


            <div className="mb-2 mt-4">
              <h4>Screenshot</h4>
              <select
                className="form-select"
                value={screenshotSource}
                onChange={(e) => setScreenshotSource(e.target.value)}
              >
                <option value="temi">Temi</option>
                <option value="web">Participant Web</option>
              </select>
            </div>
            
            {screenshotData &&
              <div className="mt-3 d-flex align-items-center justify-content-center">
                <img
                  onClick={() => setModalData(screenshotData)}
                  src={screenshotData}
                  alt="Robot Screenshot"
                  style={{
                    maxWidth: '200px', maxHeight: '150px',
                    border: '1px solid #ccc', cursor: "pointer"
                  }}
                />
              </div>
            }
            <button
                className="btn w-100 btn-success mt-1"
                onClick={() => {
                  setScreenshotData(null)
                  sendMessage({
                    command: "refreshScreenShot",
                    payload: screenshotSource
                  })
                }}>
              {screenshotData ? "Refresh" : "Fetch"}
            </button>

          </div>

          <div className="col-md-8">

            <div className="row">

              <div className="col-md-7">
                <h4>Behavioral Modes</h4>
                <div className="alert alert-info mt-2">
                  🤖 Current Mode: <strong>{getModeText()}</strong>
                </div>

                <div className="row mt-2">
                  <div className="col-sm-6">
                    <button
                        className="btn w-100 btn-warning"
                        onClick={() => sendMessage({
                          command: "changeMode",
                          payload: "reactive"
                        })}>
                      User Init.
                    </button>
                  </div>
                  <div className="col-sm-6">
                    <button
                        className="btn w-100 btn-warning"
                        onClick={() => sendMessage({
                          command: "changeMode",
                          payload: "proactive"
                        })}>
                      Robot Init.
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-md-5">
                {(secondsSinceSnapshot !== null && secondsSinceSnapshot < 30) &&
                  <>
                    <div className="text-muted small mt-1">
                      Taken {secondsSinceSnapshot} second{secondsSinceSnapshot === 1 ? '' : 's'} ago
                    </div>
                    {snapshotData &&
                      <div className="mt-3 d-flex align-items-center justify-content-center">
                        <img
                          onClick={() => setModalData(snapshotData)}
                          src={snapshotData}
                          alt="Robot View"
                          style={{
                            maxWidth: '200px', maxHeight: '150px',
                            border: '1px solid #ccc', cursor: "pointer"
                          }}
                        />
                      </div>
                    }
                  </>
                }
              </div>
            </div>



            <h4 className="mt-2">Go To ...</h4>
            {navButtonsBlock()}


            <h4 className="mt-2">Movements</h4>
            <div className="row mt-2">
              <div className="col-sm-3">
                <button
                    className={
                      `btn w-100 ${pressedButtons.includes(14) ?
                        "btn-success" :
                        "btn-primary"}`
                    }
                    onClick={() => sendMessage({
                      command: "turnBy",
                      payload: "10"
                    })}>
                  Left
                </button>
              </div>
              <div className="col-sm-3">
                <button
                    className={
                      `btn w-100 ${pressedButtons.includes(15) ?
                        "btn-success" :
                        "btn-primary"}`
                    }
                    onClick={() => sendMessage({
                      command: "turnBy",
                      payload: "-10"
                    })}>
                  Right
                </button>
              </div>
              <div className="col-sm-3">
                <button
                    className={
                      `btn w-100 ${pressedButtons.includes(12) ?
                        "btn-success" :
                        "btn-primary"}`
                    }
                    onClick={() => sendMessage({
                      command: "skidJoy",
                      payload: "(0.5, 0)"
                    })}>
                  Forward
                </button>
              </div>
              <div className="col-sm-3">
                <button
                    className={
                      `btn w-100 ${pressedButtons.includes(13) ?
                        "btn-success" :
                        "btn-primary"}`
                    }
                    onClick={() => sendMessage({
                      command: "skidJoy",
                      payload: "(-0.5, 0)"
                    })}>
                  Back
                </button>
              </div>
            </div>

            <div className="row mt-2">
              <div className="col-sm-3">
                <button
                    className={
                      `btn w-100 ${pressedButtons.includes(3) ?
                        "btn-success" :
                        "btn-primary"}`
                    }
                    onClick={() => sendMessage({
                      command: "tiltBy",
                      payload: "5"
                    })}>
                  Up
                </button>
              </div>
              <div className="col-sm-3">
                <button
                    className={
                      `btn w-100 ${pressedButtons.includes(0) ?
                        "btn-success" :
                        "btn-primary"}`
                    }
                    onClick={() => sendMessage({
                      command: "tiltBy",
                      payload: "-5"
                    })}>
                  Down
                </button>
              </div>
              <div className="col-sm-3">
                <button
                    className="btn w-100 btn-primary"
                    onClick={() => sendMessage({
                      command: "tiltAngle",
                      payload: "0"
                    })}>
                  👀 ahead
                </button>
              </div>
              <div className="col-sm-3">
                <button
                    className="btn w-100 btn-danger"
                    onClick={() => sendMessage({
                      command: "stopMovement",
                      payload: ""
                    })}>
                  STOP
                </button>
              </div>
            </div>


            <h4 className="mt-2">Screen</h4>
            <div className="row mt-2">
              <div className="col-sm-6">
                <button
                    disabled={!canActivateCamera}
                    className="btn w-100 btn-primary"
                    onClick={() => {
                      sendMessage({
                        command: "navigateCamera",
                        payload: ""
                      })
                      setCanActivateCamera(false);
                    }}>
                    {/*behaviorMode === 'proactive' ? "Activate Camera" : "Display Camera"*/}
                    Activate Camera
                </button>
              </div>
              <div className="col-sm-6">
                <button
                    className="btn w-100 btn-primary"
                    onClick={() => sendMessage({
                      command: "displayFace",
                      payload: ""
                    })}>
                  Display Face
                </button>
              </div>
              
            </div>

            <div className="row mt-2">
              <div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    // disabled={!canTakePicture}
                    onClick={() => {
                      sendMessage({
                        command: "takePicture",
                        payload: ""
                      })
                      // setCanTakePicture(false)
                      // setCanStartVideo(false)
                    }}>
                  Take Picture
                </button>
              </div>
              {/*<div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    disabled={!canStartVideo}
                    onClick={() => {
                      sendMessage({
                        command: "startVideo",
                        payload: ""
                      })
                      setCanTakePicture(false)
                      setCanStartVideo(false)
                    }}>
                  Start Video
                </button>
              </div>
              <div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    disabled={!canStopVideo}
                    onClick={() => {
                      sendMessage({
                        command: "stopVideo",
                        payload: ""
                      })
                      setTimeout(() => {
                        sendMessage({
                          command: "speak",
                          payload: "I just captured a video clip! Review and share with your family if you want."
                        })
                      }, 4000);
                      setCanTakePicture(false)
                      setCanStartVideo(false)
                    }}>
                  Stop Video
                </button>
              </div>*/}
            </div>


            <h4 className="mt-2">Participant Web View</h4>
            <div className="row mt-2">
              <div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    onClick={() => sendMessage({
                      command: "displayMode",
                      payload: "admin"
                    })}>
                  Show Buttons
                </button>
              </div>
              <div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    onClick={() => sendMessage({
                      command: "displayMode",
                      payload: "in-study"
                    })}>
                  Hide Buttons
                </button>
              </div>
              <div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    onClick={() => sendMessage({
                      command: "allowCapture",
                      payload: ""
                    })}>
                  Enable Capture Btn
                </button>
              </div>
            </div>

            <h4 className="mt-2">Robot Admin</h4>
            <div className="row mt-2">
              {/* Does not work on Robot yet */}
              {/*<div className="col-sm-4">
                <button
                    className="btn w-100 btn-primary"
                    onClick={() => sendMessage({
                      command: "zoomToken",
                      payload: ""
                    })}>
                  Start Zoom
                </button>
              </div>*/}
            </div>
            


          </div>
        </div>

      </div>
    </div>
  );
}

export default WizardPage;
