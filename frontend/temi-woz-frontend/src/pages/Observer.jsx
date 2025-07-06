// // src/pages/ParticipantPage.jsx
// import React, { useEffect, useState } from 'react'
// import uitoolkit from "@zoom/videosdk-ui-toolkit";
// import "@zoom/videosdk-ui-toolkit/dist/videosdk-ui-toolkit.css";
// import ZoomVideo from '@zoom/videosdk'

// import { connectWebSocket, sendMessageWS } from "../utils/ws";
// import { fetchZoomToken } from "../utils/utils"; 


// // TODO: periodic fetch current Zoom status and display


// const ObserverPage = () => {

//   const [showZoomUI, setShowZoomUI] = useState(false);
//   const [zoomStream, setZoomStream] = useState(null);
//   const [zoomStatus, setZoomStatus] = useState(null);
//   const [behaviorMode, setBehaviorMode] = useState(null);
//   const [notification, setNotification] = useState(null);

//   var client = ZoomVideo.createClient()

//   useEffect(() => {
//     console.log(zoomStream)
//   }, [zoomStream]);


//   const sendMessage = (message) => {
//     sendMessageWS(message);
//   };

//   function useZoomStatusPoller(sendMessage, intervalMs = 2500) {
//     useEffect(() => {
//       const intervalId = setInterval(() => {
//         sendMessage({ command: "zoom_status" });
//       }, intervalMs);

//       return () => clearInterval(intervalId); // Cleanup on unmount
//     }, [sendMessage, intervalMs]);
//   }

//   // poll zoom call status
//   useZoomStatusPoller(sendMessage);

//   function formatDuration(seconds) {
//     if (seconds > 10000) {
//       return 'error'
//     }
//     const totalSeconds = Math.floor(seconds);
//     const minutes = Math.floor(totalSeconds / 60);
//     const secondsLeft = totalSeconds % 60;
//     return `${minutes}m ${secondsLeft}s`;
//   }


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
//         if (data.data === 'end') {
//           setNotification('User ended call. Remember to mute all users using Zoom UI.')
//           setTimeout(() => setNotification(null), 3000);
//         }
//       } else if (data.type === "zoom_status") {
//         setZoomStatus(data.data)
//       }
//     }
//     // share the path of the main control page
//     connectWebSocket(onWsMessage, "control");
//   }, []);


//   // console.log(import.meta.env.VITE_ZOOM_JWT)

//   var config = {
//     videoSDKJWT: import.meta.env.VITE_ZOOM_JWT,
//     sessionName: "research-study",
//     userName: "Meeting Bot",
//     featuresOptions: {
//       'feedback': {
//         enable: false
//       },
//       'leave': {
//         enable: true
//       },
//       'video': {
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
//     console.log(token)
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

//   return (
//     <div className="container-fluid p-0">
//       <nav className="navbar navbar-dark bg-dark fixed-top">
//         <span className="navbar-brand mb-0 h1">🤖 Observer Dashboard (Mode: {behaviorMode})</span>
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

//         {!showZoomUI &&
//           <button
//               onClick={() => {
//                 startVideoCall()
//               }}
//               className="btn btn-primary">
//             Start Video Call
//           </button>
//         }

        
//           <div
//             style={{
//               display: showZoomUI ? 'block' : 'none'
//             }}>
//             <div className="row">
//               <div className="col-md-8">
//                 <h4>Video Panel</h4>
//                 <div
//                   id="sessionContainer"
//                   style={{
//                     height: '70vh',
//                   }}
//                 ></div>
//               </div>

//               <div className="col-md-4">
//                 {zoomStatus &&
//                   <div>
//                     <h3>Zoom Call Status</h3>
//                     <p><strong>Robot:</strong> {zoomStatus.robot || 'N/A'}</p>
//                     <p><strong>Participant:</strong> {zoomStatus.participant || 'N/A'}</p>
//                     <p>
//                       <strong>Call Duration:</strong> {formatDuration(zoomStatus.call_duration)}
//                     </p>
//                     {(zoomStatus.call_duration > 150) &&
//                       <div className="alert alert-danger">
//                         The call is getting close to duration limit:
//                         <ol>
//                           <li>Click on "Announce Ending"</li>
//                           <li>As we get to 3:00, click on "End All"</li>
//                           <li>Mute All through Zoom UI</li>
//                         </ol>
//                       </div>
//                     }
//                   </div>
//                 }

//                 <h4 className="mt-2">Controls</h4>
//                 <div className="row mt-2">
//                   <div className="col-12">
//                     <button
//                         className="btn w-100 btn-primary"
//                         disabled={behaviorMode !== "proactive"}
//                         onClick={() => sendMessage({
//                           command: "video_call",
//                           payload: "proactive_call"
//                         })}>
//                       Call All
//                     </button>
//                   </div>
//                 </div>

//                 <div className="row mt-2">
//                   <div className="col-sm-6">
//                     <button
//                         className="btn w-100 btn-primary"
//                         onClick={() => {
//                           setZoomStream(client.getMediaStream());
//                         }}>
//                       Get Stream
//                     </button>
//                   </div>
//                   <div className="col-sm-6">
//                     <button
//                         className="btn w-100 btn-primary"
//                         onClick={() => {
//                           zoomStream.muteAudio()
//                         }}>
//                       Mute Audio
//                     </button>
//                   </div>
//                 </div>

//                 <div className="row mt-2">
//                   <div className="col-sm-6">
//                     <button
//                         className="btn w-100 btn-primary"
//                         onClick={() => sendMessage({
//                           command: "video_call",
//                           payload: "ending_alert"
//                         })}>
//                       Announce Ending
//                     </button>
//                   </div>
//                   <div className="col-sm-6">
//                     <button
//                         className="btn w-100 btn-primary"
//                         onClick={() => sendMessage({
//                           command: "video_call",
//                           payload: "end"
//                         })}>
//                       End All
//                     </button>
//                   </div>
//                   {/*<div className="col-sm-3">
//                     <button
//                         className="btn w-100 btn-primary"
//                         onClick={() => sendMessage({
//                           command: "zoom_status"
//                         })}>
//                       Call Status
//                     </button>
//                   </div>*/}
//                 </div>
//               </div>
//             </div>

//           </div>


//       </div>
//     </div>
//   );
// };

// export default ObserverPage;
