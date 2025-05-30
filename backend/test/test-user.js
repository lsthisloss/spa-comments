import { io } from "socket.io-client";

try {
  console.log("First test");
  const socket = io("ws://localhost:3001/users", {
    transports: ["websocket"],
  });
  
  console.log("Connecting to /users namespace...");
  socket.on("connect", () => {
    console.log("Connected!");
    socket.emit(
      "register",
      {
        email: "test5@example.com",
        userName: "5testuser",
        password: "testpassword"
      },
      (response) => {
        console.log("Ответ на register:", response);
        socket.disconnect();
      }
    );
  });

  socket.onAny((event, data) => {
    console.log("Event:", event, "Data:", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
  });
} catch (error) {
  console.error("Error connecting to socket:", error);
}