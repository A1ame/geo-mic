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
let pendingRequests = {}; // Очередь на вход
let adminInfo = { name: "Ожидание админа...", peerId: null, socketId: null };

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
  socket.emit("admin-updated", adminInfo);
  if (activeZone) socket.emit("zone-updated", activeZone);

  // Запрос на вступление
  socket.on("request-join", (data) => {
    pendingRequests[socket.id] = { ...data, socketId: socket.id };
    if (adminInfo.socketId) {
      io.to(adminInfo.socketId).emit("new-request", Object.values(pendingRequests));
    }
  });

  // Админ одобряет участника
  socket.on("approve-user", (socketId) => {
    const userData = pendingRequests[socketId];
    if (userData) {
      participants[socketId] = { ...userData, handRaised: false, isOnAir: false };
      delete pendingRequests[socketId];
      io.to(socketId).emit("join-approved", { approved: true });
      io.emit("participants-list", Object.values(participants));
      if (adminInfo.socketId) io.to(adminInfo.socketId).emit("new-request", Object.values(pendingRequests));
    }
  });

  socket.on("join", (data) => {
    Object.keys(participants).forEach(id => {
      if (participants[id].name === data.name) delete participants[id];
    });

    if (data.role === 'admin') {
      adminInfo = { name: data.name, peerId: data.peerId, socketId: socket.id };
      io.emit("admin-updated", adminInfo);
    } else {
        // Если юзер уже был одобрен (перезагрузка), восстанавливаем
        participants[socket.id] = { ...data, socketId: socket.id, handRaised: false, isOnAir: false };
    }
    socket.join("main-room");
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("set-zone", (zone) => { activeZone = zone; io.emit("zone-updated", zone); });
  socket.on("stop-event", () => { activeZone = null; io.emit("zone-updated", null); });

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
    if (participants[data.socketId]) participants[data.socketId].isOnAir = false;
    io.emit("mic-revoked", data);
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("disconnect", () => {
    if (pendingRequests[socket.id]) {
        delete pendingRequests[socket.id];
        if (adminInfo.socketId) io.to(adminInfo.socketId).emit("new-request", Object.values(pendingRequests));
    }
    if (participants[socket.id]) {
      if (participants[socket.id].role === 'admin') {
        adminInfo.peerId = null;
        io.emit("admin-updated", adminInfo);
      }
      delete participants[socket.id];
      io.emit("participants-list", Object.values(participants));
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => { console.log(`Server started on port ${PORT}`); });