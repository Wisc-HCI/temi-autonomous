// // src/pages/ParticipantPage.jsx
// import React, { useEffect, useState, useRef } from 'react'
// import uitoolkit from "@zoom/videosdk-ui-toolkit";
// import "@zoom/videosdk-ui-toolkit/dist/videosdk-ui-toolkit.css";

// import { connectWebSocket, sendMessageWS } from "../utils/ws";
// import { useGamepadControls } from "../utils/useGamepadControls";
// import { fetchZoomToken, captureAndSend } from "../utils/utils"; 



// const ParticipantSyncPage = () => {

//   const [showZoomUI, setShowZoomUI] = useState(false);
//   const [videoCallStatus, setVideoCallStatus] = useState(null);
//   const [pressedButtons, setPressedButtons] = useState([]);
//   const [notification, setNotification] = useState(null);
//   const [showAdminButtons, setShowAdminButtons] = useState(true);
//   const [behaviorMode, setBehaviorMode] = useState(null);

//   const ringtoneRef = useRef(null);

//   const sendMessage = (message) => {
//     sendMessageWS(message);
//   };

//   useEffect(() => {
//     const onWsMessage = (data) => {
//       console.log('onWsMessage')
//       console.log(data)
//       if (data.type === "media_uploaded") {
//         const msg = `✅ Media uploaded: ${data.filename}`;
//         // setUploadNotification(msg);
//         // setLatestUploadedFile(data.filename); 
//         // setTimeout(() => setUploadNotification(null), 3000);
//       } else if (data.type === "initial_status") {
//         setBehaviorMode(data.data.behavior_mode);
//       } else if (data.type === "behavior_mode") {
//         setBehaviorMode(data.data);
//       } else if (data.type === "video_call") {
//         if (data.data === 'start') {
//           setVideoCallStatus('ringing');
//         } else if (data.data === 'end') {
//           setVideoCallStatus(null);
//           setShowZoomUI(false);
//         } else if (data.data === 'answer') {
//           setVideoCallStatus('connected');
//           setTimeout(() => setShowZoomUI(true), 1000);
//           setNotification("Call connected. Remember to unmute yourself!")
//           setTimeout(() => setNotification(null), 4000);
//         } else if (data.data === 'dismiss') {
//           setVideoCallStatus(null);
//           setNotification("Call was dismissed or timed out. Please try again later.")
//           setTimeout(() => setNotification(null), 5000);
//         } else if ( data.data === 'proactive_call') {
//           setVideoCallStatus('ringing');
//           playRingtoneWithPause();
//         } else if ( data.data === 'connected') {
//           setVideoCallStatus('connected');
//           setTimeout(() => setShowZoomUI(true), 1000);
//           setNotification("Call connected. Remember to unmute yourself!")
//           setTimeout(() => setNotification(null), 4000);
//         } else if ( data.data === "ending_alert") {
//           setNotification("Call duration is approaching 3 minutes, and it will be terminated in 15 seconds.")
//           setTimeout(() => setNotification(null), 3000);
//         }
//       } else if (data.command === "displayMode") {
//         if (data.payload === 'admin') {
//           setShowAdminButtons(true);
//         } else {
//           setShowAdminButtons(false);
//         }
//       } else if (data.command === "refreshScreenShot") {
//         captureAndSend(sendMessage);
//       }
//     }
//     connectWebSocket(onWsMessage, "participant");
//   }, []);


//   const playRingtoneWithPause = () => {
//     const audio = new Audio('/audio/ringtone.mp3');
//     ringtoneRef.current = audio;

//     const loopWithPause = () => {
//       audio.currentTime = 0;
//       audio.play().catch(e => console.warn("Autoplay blocked:", e));

//       // When finished playing...
//       audio.onended = () => {
//         setTimeout(() => {
//           if (ringtoneRef.current === audio) {
//             loopWithPause();
//           }
//         }, 1500);
//       };
//     };

//     loopWithPause();
//   };

//   const stopRingtone = () => {
//     if (ringtoneRef.current) {
//       ringtoneRef.current.pause();
//       ringtoneRef.current.currentTime = 0;
//       ringtoneRef.current = null;
//     }
//   };

//   useGamepadControls(sendMessage, setPressedButtons);

//   // console.log(import.meta.env.VITE_ZOOM_JWT)

//   var config = {
//     videoSDKJWT: null,
//     sessionName: "research-study",
//     userName: "Tablet",
//     featuresOptions: {
//       'feedback': {
//         enable: false
//       },
//       'leave': {
//         enable: false
//       },
//       'users': {
//         enable: false
//       },
//       'chat': {
//         enable: false,
//       },
//       'share': {
//         enable: false,
//       },
//       'subsession': {
//         enable: false,
//       },

//     }
//   };


//   const startVideoCall = async () => {
//     setShowZoomUI(true)
//     const sessionContainer = document.getElementById('sessionContainer');
//     var token = await fetchZoomToken();
//     if (token === null) {
//       token = import.meta.env.VITE_ZOOM_JWT
//     }
//     config['videoSDKJWT'] = token

//     uitoolkit.joinSession(sessionContainer, config);
//     const sessionDestroyed = () => {
//       console.log("sessionDestroyed")
//       uitoolkit.destroy();
//       setShowZoomUI(false)
//     }
//     uitoolkit.onSessionDestroyed(sessionDestroyed);
//   }

//   const answerBtnOnClick = () => {
//     stopRingtone();
//     if (behaviorMode === 'proactive') {
//       setVideoCallStatus('waiting');
//       sendMessage({
//         command: "video_call",
//         payload: "answer"
//       })
//     } else {
//       setVideoCallStatus('connected');
//       sendMessage({
//         command: "video_call",
//         payload: "answer"
//       })
//       setTimeout(() => setShowZoomUI(true), 2000);
//       setNotification("Call connected. Remember to unmute yourself!")
//       setTimeout(() => setNotification(null), 4000);
//     }
//   }

//   const dismissBtnOnClick = () => {
//     stopRingtone();
//     setVideoCallStatus(null);
//     sendMessage({
//       command: "video_call",
//       payload: "dismiss"
//     })
//   }

//   const showCallButton = () => {
//     return behaviorMode === 'reactive' && videoCallStatus === null
//   }

//   return (
//     <div className="container-fluid p-0">
//       <nav className="navbar navbar-dark bg-dark fixed-top">
//         <span className="navbar-brand mb-0 h1">🤖 Participant Dashboard {showAdminButtons && `(${behaviorMode})`}</span>
//       </nav>

//       {notification && (
//         <div
//           className="alert alert-warning position-fixed bottom-50 start-50 translate-middle-x mb-3 shadow"
//           role="alert"
//           style={{ zIndex: 1050 }}
//         >
//           {notification}
//         </div>
//       )}

//       <div className="container-fluid main-content mt-5 pt-2">

//         {showAdminButtons &&
//           <button
//               onClick={() => {
//                 startVideoCall()
//               }}
//               className="btn btn-primary">
//             Start Video Call
//           </button>
//         }


//         <div
//             style={{
//               display: showZoomUI ? 'none' : 'block'
//             }}
//             className="row">
//           <div
//             className="col-12 w-100 text-center mt-5"
//             style={{ minHeight: "160px", minWidth: "200px" }}
//           >

//             {videoCallStatus === 'ringing' &&
//               <>
//                 <div className="row">
//                   <div className="col-md-10 offset-md-1">
//                     <h1 className="display-5">You have an incomging call!</h1>
//                   </div>
//                 </div>
//                 <div className="row mt-5">
//                   <div className="col-md-3 offset-md-3">
//                     <button
//                       onClick={() => {answerBtnOnClick()}}
//                       className="btn btn-success w-100">
//                       Answer Call
//                     </button>
//                   </div>
//                   <div className="col-md-3">
//                     <button
//                       onClick={() => {dismissBtnOnClick()}}
//                       className="btn btn-danger w-100">
//                       Dismiss
//                     </button>
//                   </div>
//                 </div>
//               </>
//             }

//             {videoCallStatus === 'waiting' &&
//               <div className="row">
//                 <div className="col-md-10 offset-md-1 alert alert-warning">
//                   <h1>Waiting for the other user to answer the call ...</h1>
//                 </div>
//               </div>
//             }

//             {videoCallStatus === null &&
//               <h1 className="display-5">No on-going video call</h1>
//             }

//             {videoCallStatus === "calling" &&
//               <div 
//                 className="alert alert-warning py-4"
//                 style={{fontSize: "1.6rem"}}>Calling robot. Waiting for the other user to answer.
//               </div>
//             }

//             {showCallButton() &&
//               <>
//                 <div className="row mt-3">
//                   <div className="col-md-4 offset-md-4">
//                     <button
//                       onClick={() => {
//                         setVideoCallStatus('calling');
//                         sendMessage({
//                           command: "video_call",
//                           payload: "start"
//                         })
//                         // setTimeout(() => setShowZoomUI(true), 2000);
//                       }}
//                       className="btn btn-primary w-100 mt-4">
//                       <span style={{fontSize: "1.6rem"}}>
//                         Call Robot
//                       </span>
//                     </button>
//                   </div>
//                 </div>
//               </>
//             }

//           </div>
//         </div>


        
//         <div
//           style={{
//             display: showZoomUI ? 'block' : 'none'
//           }}>
//           <div className="row">
//             {/* Video Panel */}
//             <div className="col-md-8">
//               <div
//                 id="sessionContainer"
//                 style={{
//                   height: '70vh',
//                 }}
//               ></div>
//                 {showAdminButtons &&
//                   <button
//                     onClick={() => {
//                       setShowZoomUI(false);
//                     }}
//                     className="btn btn-primary">
//                   Hide
//                 </button>
//               }
//             </div>

//             <div className="col-md-4">

//               <div className="row">
//                 <h4 className="my-2">Movements</h4>
//                   <div className="d-flex flex-column align-items-center">

//                     {/* Up */}
//                     <div className="mb-2">
//                       <button
//                         className={`dpad-btn btn ${pressedButtons.includes(12) ? "btn-success" : "btn-primary"}`}
//                         onClick={() =>
//                           sendMessage({ command: "skidJoy", payload: "(0.5, 0)" })
//                         }
//                       >
//                         ↑
//                       </button>
//                     </div>

//                     {/* Left, Right */}
//                     <div className="d-flex justify-content-between mb-2" style={{ width: "180px" }}>
//                       <button
//                         className={`dpad-btn btn ${pressedButtons.includes(14) ? "btn-success" : "btn-primary"}`}
//                         onClick={() =>
//                           sendMessage({ command: "turnBy", payload: "10" })
//                         }
//                       >
//                         ←
//                       </button>

//                       <button
//                         className={`dpad-btn btn ${pressedButtons.includes(15) ? "btn-success" : "btn-primary"}`}
//                         onClick={() =>
//                           sendMessage({ command: "turnBy", payload: "-10" })
//                         }
//                       >
//                         →
//                       </button>
//                     </div>

//                     {/* Down */}
//                     <div>
//                       <button
//                         className={`dpad-btn btn ${pressedButtons.includes(13) ? "btn-success" : "btn-primary"}`}
//                         onClick={() =>
//                           sendMessage({ command: "skidJoy", payload: "(-0.5, 0)" })
//                         }
//                       >
//                         ↓
//                       </button>
//                     </div>
//                   </div>
//                   <div className="mt-3">
//                     <button
//                         className="btn w-100 btn-warning"
//                         onClick={() => sendMessage({
//                           command: "stopMovement",
//                           payload: ""
//                         })}>
//                       STOP Movement
//                     </button>
//                   </div>

//               </div>

//               {/*<div className="row">
//                 <h4 className="my-2">Movements</h4>
//                 <div className="col-sm-3">
//                   <button
//                       className={
//                         `btn w-100 ${pressedButtons.includes(14) ?
//                           "btn-success" :
//                           "btn-primary"}`
//                       }
//                       onClick={() => sendMessage({
//                         command: "turnBy",
//                         payload: "10"
//                       })}>
//                     Left
//                   </button>
//                 </div>
//                 <div className="col-sm-3">
//                   <button
//                       className={
//                         `btn w-100 ${pressedButtons.includes(15) ?
//                           "btn-success" :
//                           "btn-primary"}`
//                       }
//                       onClick={() => sendMessage({
//                         command: "turnBy",
//                         payload: "-10"
//                       })}>
//                     Right
//                   </button>
//                 </div>
//                 <div className="col-sm-3">
//                   <button
//                       className={
//                         `btn w-100 ${pressedButtons.includes(12) ?
//                           "btn-success" :
//                           "btn-primary"}`
//                       }
//                       onClick={() => sendMessage({
//                         command: "skidJoy",
//                         payload: "(0.5, 0)"
//                       })}>
//                     Forward
//                   </button>
//                 </div>
//                 <div className="col-sm-3">
//                   <button
//                       className={
//                         `btn w-100 ${pressedButtons.includes(13) ?
//                           "btn-success" :
//                           "btn-primary"}`
//                       }
//                       onClick={() => sendMessage({
//                         command: "skidJoy",
//                         payload: "(-0.5, 0)"
//                       })}>
//                     Back
//                   </button>
//                 </div>
//               </div>*/}

//               <div className="row mt-2">
//                 <h4 className="my-2">Head Tilt</h4>
//                 <div className="col-sm-3">
//                   <button
//                       className={
//                         `btn w-100 ${pressedButtons.includes(3) ?
//                           "btn-success" :
//                           "btn-primary"}`
//                       }
//                       onClick={() => sendMessage({
//                         command: "tiltBy",
//                         payload: "5"
//                       })}>
//                     Up
//                   </button>
//                 </div>
//                 <div className="col-sm-3">
//                   <button
//                       className={
//                         `btn w-100 ${pressedButtons.includes(0) ?
//                           "btn-success" :
//                           "btn-primary"}`
//                       }
//                       onClick={() => sendMessage({
//                         command: "tiltBy",
//                         payload: "-5"
//                       })}>
//                     Down
//                   </button>
//                 </div>
//                 <div className="col-sm-6">
//                   <button
//                       className="btn w-100 btn-primary"
//                       onClick={() => sendMessage({
//                         command: "tiltAngle",
//                         payload: "0"
//                       })}>
//                     Look Ahead
//                   </button>
//                 </div>
//                 {/*<div className="col-sm-3">
//                   <button
//                       className="btn w-100 btn-danger"
//                       onClick={() => sendMessage({
//                         command: "stopMovement",
//                         payload: ""
//                       })}>
//                     STOP
//                   </button>
//                 </div>*/}
//               </div>


//               <div className="row mt-5">
//                 {videoCallStatus === "connected" &&
//                   <div className="col-12">
//                     <button
//                       onClick={() => {
//                         sendMessage({
//                           command: "video_call",
//                           payload: "end"
//                         })
//                         setTimeout(() => {
//                           setShowZoomUI(false);
//                           setVideoCallStatus(null);
//                         }, 500);
//                       }}
//                       className="btn btn-danger w-100">
//                       End Call
//                     </button>
//                   </div>
//                 }
//               </div>

//             </div>

//           </div>
//         </div>



//       </div>
//     </div>
//   );
// };

// export default ParticipantSyncPage;
