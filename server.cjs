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
let adminInfo = { name: "Ожидание админа...", peerId: null }; // Храним данные админа

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
  // Сразу отправляем данные о событии новому клиенту
  socket.emit("admin-updated", adminInfo);
  if (activeZone) socket.emit("zone-updated", activeZone);

  socket.on("join", (data) => {
    // Чистим дубликаты
    Object.keys(participants).forEach(id => {
      if (participants[id].name === data.name) delete participants[id];
    });

    if (data.role === 'admin') {
      adminInfo = { name: data.name, peerId: data.peerId };
      io.emit("admin-updated", adminInfo); // Оповещаем всех, что админ (пере)зашел
    }

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
      if (participants[socket.id].role === 'admin') {
        // Если админ ушел, обнуляем его peerId, но оставляем имя для истории
        adminInfo.peerId = null;
        io.emit("admin-updated", adminInfo);
      }
      delete participants[socket.id];
      io.emit("participants-list", Object.values(participants));
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => { console.log(`Server started on port ${PORT}`); });