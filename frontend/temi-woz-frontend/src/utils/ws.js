let socket;
let reconnectTimeout = null;


export function connectWebSocket(onMessage, path) {
  const connect = () => {
    console.log("Connecting WebSocket...");
    socket = new WebSocket(`ws://${window.location.hostname}:8000/${path}`);

    socket.onopen = () => {
      console.log("WebSocket connected");
      socket.send(JSON.stringify({ command: "identify", payload: "webpage" }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received:", data);
      onMessage?.(data);
    };

    socket.onclose = () => {
      console.warn("WebSocket closed");
      reconnectTimeout = setTimeout(connect, 2000); // try again in 2s
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      // let onclose handle the reconnect
    };
  };

  connect();
}

export function sendMessageWS(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.warn("WebSocket not open");
  }
}
