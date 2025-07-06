// // src/pages/ParticipantPage.jsx
// import React, { useEffect, useState, useRef } from 'react'
// import { connectWebSocket, sendMessageWS } from "../utils/ws";
// import MediaList from '../components/MediaList';
// import { captureAndSend } from "../utils/utils"; 


// const ParticipantAsyncPage = () => {

//   const [notification, setNotification] = useState(null);
//   const [notificationType, setNotificationType] = useState(null);
//   const [showAdminButtons, setShowAdminButtons] = useState(true);
//   const [behaviorMode, setBehaviorMode] = useState(null);
//   const [latestUploadedFile, setLatestUploadedFile] = useState(null);
//   const [canRequest, setCanRequest] = useState(true);
//   const [requestDeclined, setRequestDeclined] = useState(false);
//   const [captureTriggerBy, setCaptureTriggerBy] = useState(null);

//   const captureTriggerByRef = useRef(captureTriggerBy);
//   const canRequestRef = useRef(canRequest);

//   useEffect(() => {
//     captureTriggerByRef.current = captureTriggerBy;
//   }, [captureTriggerBy]);

//   useEffect(() => {
//     canRequestRef.current = canRequest;
//   }, [canRequest]);

//   const playChimes = () => {
//     const audio = new Audio('/audio/chime.mp3');
//     let playCount = 0;

//     audio.addEventListener('ended', () => {
//       playCount += 1;
//       if (playCount < 3) {
//         audio.currentTime = 0;
//         audio.play();
//       }
//     });

//     audio.play().catch(e => console.warn("Audio play blocked:", e));
//   };

//   const sendMessage = (message) => {
//     sendMessageWS(message);
//   };


//   useEffect(() => {
//     const onWsMessage = (data) => {
//       console.log('onWsMessage')
//       console.log(data)
//       if (data.type === "media_uploaded") {
//         const msg = "✅ New Acitivity Stream Uploaded!";
//         setNotificationType('success')
//         setNotification(msg);
//         setLatestUploadedFile(data.filename); 
//         setCanRequest(true);
//         setRequestDeclined(false);
//         setTimeout(() => setNotification(null), 4000);
//         playChimes();
//       } else if (data.type === "declined_share") {
//         console.log('declined share')
//         console.log(canRequestRef.current)
//         console.log(captureTriggerByRef.current)
//         // only trigger it if the capture was triggered by the tablet
//         if (canRequestRef.current === false) {
//           setCanRequest(true);
//           if (captureTriggerByRef.current === 'tablet_user') {
//             setRequestDeclined(true);
//             playChimes();
//           }
//         }
//       } else if (data.type === "initial_status") {
//         setBehaviorMode(data.data.behavior_mode);
//       } else if (data.type === "video_capture") {
//         setCanRequest(false);
//         setCaptureTriggerBy('robot_user')
//       } else if (data.type === "behavior_mode") {
//         setBehaviorMode(data.data);
//       } else if (data.command === "displayMode") {
//         if (data.payload === 'admin') {
//           setShowAdminButtons(true);
//         } else {
//           setShowAdminButtons(false);
//         }
//       } else if (data.command === "allowCapture") {
//         setCanRequest(true);
//       } else if (data.command === "refreshScreenShot") {
//         captureAndSend(sendMessage);
//       }
//     }
//     connectWebSocket(onWsMessage, "participant");
//   }, []);


//   var config = {
//     videoSDKJWT: null,
//     sessionName: "research-study",
//     userName: "Laptop",
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


//   return (
//     <div className="container-fluid p-0">
//       <nav className="navbar navbar-dark bg-dark fixed-top">
//         <span className="navbar-brand mb-0 h1">🤖 Participant Dashboard {showAdminButtons && `(${behaviorMode})`}</span>
//       </nav>

//       {notification && (
//         <div
//           className={`alert alert-${notificationType} position-fixed
//             bottom-50 start-50 translate-middle-x shadow d-flex
//             align-items-center justify-content-center text-center`
//           }
//           role="alert"
//           style={{ zIndex: 1050, minHeight: "160px", minWidth: "200px" }}
//         >
//           {notification}
//         </div>
//       )}

//       <div className="container-fluid main-content mt-5 pt-2">

//         {behaviorMode === 'reactive' &&
//           <>
//             <div className="row mt-4">
//   {/*            <div className="col-md-4 mt-1">
//                 <button
//                     className="btn w-100 btn-primary"
//                     disabled={!canRequest}
//                     onClick={() => {
//                       setCanRequest(false);
//                       sendMessage({
//                         command: "initiateCapture",
//                         payload: "photo"
//                       })
//                     }}>
//                   Request New Picture
//                 </button>
//               </div>*/}
//               <div className="col-md-4 mt-1">
//                 <button
//                     className="btn w-100 btn-primary py-4"
//                     disabled={!canRequest}
//                     onClick={() => {
//                       setCanRequest(false);
//                       setRequestDeclined(false);
//                       setCaptureTriggerBy('tablet_user');
//                       sendMessage({
//                         command: "initiate_capture",
//                         payload: "video"
//                       })
//                     }}>
//                   Send the robot to take a video clip
//                 </button>
//               </div>
//             </div>

//             {!canRequest &&
//               <div className="row my-2">
//                 <div className="col-md-8">
//                   <div
//                     className="alert alert-success"
//                     role="alert"
//                   >
//                     The robot is on its way to take a video. You will be notified when/if the video is shared with you!
//                   </div>
//                 </div>
//               </div>
//             }
//             {requestDeclined &&
//               <div className="row my-4">
//                 <div className="col-md-8">
//                   <div
//                     className="alert alert-warning mb-1"
//                     role="alert"
//                   >
//                     Family member didn't want to share the latest video clip captured.
//                   </div>
//                   <button
//                     className="btn btn-primary"
//                     onClick={() => {
//                       setRequestDeclined(false);
//                     }}>
//                     Okay
//                   </button>
//                 </div>
//               </div>
//             }
//           </>
//         }

//         <div className="row">
//           <div className="col-12">
//             <MediaList
//               sendMessage={null}
//               newMediaFile={latestUploadedFile}
//               displayedMedia={null}
//             />
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// };

// export default ParticipantAsyncPage;
