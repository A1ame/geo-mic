const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer(app);

let activeZone = null;
let participants = {}; 

const io = new Server(httpServer, {
  cors: { origin: [FRONTEND_URL, "http://localhost:5173"], methods: ["GET", "POST"], credentials: true },
  transports: ["polling", "websocket"]
});

const peerServer = ExpressPeerServer(httpServer, {
  debug: true, path: "/", proxied: true, allow_discovery: true,
  corsOptions: { origin: FRONTEND_URL, methods: ["GET", "POST"] }
});

app.use("/peerjs", peerServer);

io.on("connection", (socket) => {
  if (activeZone) socket.emit("zone-updated", activeZone);

  socket.on("join", (data) => {
    // УДАЛЕНИЕ ДУБЛИКАТОВ: ищем участника с таким же именем
    Object.keys(participants).forEach(id => {
      if (participants[id].name === data.name && participants[id].role === 'user') {
        delete participants[id];
      }
    });

    participants[socket.id] = { ...data, socketId: socket.id, handRaised: false, isOnAir: false };
    socket.join("main-room");
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("set-zone", (zone) => {
    activeZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("stop-event", () => {
    activeZone = null;
    io.emit("zone-updated", null);
  });

  socket.on("update-coords", (data) => {
    if (participants[socket.id]) {
      participants[socket.id].coords = data.coords;
      io.emit("participants-list", Object.values(participants));
    }
  });

  socket.on("raise-hand", () => {
    if (participants[socket.id]) {
      participants[socket.id].handRaised = true;
      io.emit("participants-list", Object.values(participants));
    }
  });

  socket.on("give-mic", (data) => {
    if (participants[data.socketId]) {
      participants[data.socketId].isOnAir = true;
      participants[data.socketId].handRaised = false;
    }
    io.emit("mic-granted", data);
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("revoke-mic", (data) => {
    if (participants[data.socketId]) {
      participants[data.socketId].isOnAir = false;
    }
    io.emit("mic-revoked", data);
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("disconnect", () => {
    if (participants[socket.id]) {
      delete participants[socket.id];
      io.emit("participants-list", Object.values(participants));
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => { console.log(`Server started on port ${PORT}`); });