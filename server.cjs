const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: [FRONTEND_URL, "http://localhost:5173"], methods: ["GET", "POST"], credentials: true },
  transports: ["polling", "websocket"]
});

const peerServer = ExpressPeerServer(httpServer, { debug: true, path: "/" });
app.use("/peerjs", peerServer);

let participants = {}; 
let pendingRequests = {}; 

const broadcastEvents = () => {
  const activeEvents = Object.values(participants)
    .filter(p => p.role === 'admin')
    .map(p => ({ name: p.name, socketId: p.socketId, peerId: p.peerId }));
  // Рассылаем всем подключенным
  io.emit("available-events", activeEvents);
};

io.on("connection", (socket) => {
  // Сразу при подключении отправляем текущий список событий
  const activeEvents = Object.values(participants)
    .filter(p => p.role === 'admin')
    .map(p => ({ name: p.name, socketId: p.socketId, peerId: p.peerId }));
  socket.emit("available-events", activeEvents);

  socket.on("join", (data) => {
    participants[socket.id] = { ...data, socketId: socket.id, handRaised: false, isOnAir: false };
    broadcastEvents();
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("request-join", (data) => {
    const { adminSocketId, name } = data;
    if (!pendingRequests[adminSocketId]) pendingRequests[adminSocketId] = [];
    if (!pendingRequests[adminSocketId].find(r => r.socketId === socket.id)) {
      pendingRequests[adminSocketId].push({ name, socketId: socket.id });
    }
    io.to(adminSocketId).emit("new-request", pendingRequests[adminSocketId]);
  });

  socket.on("approve-user", (userSocketId) => {
    const adminId = socket.id;
    if (pendingRequests[adminId]) {
      pendingRequests[adminId] = pendingRequests[adminId].filter(r => r.socketId !== userSocketId);
      io.to(adminId).emit("new-request", pendingRequests[adminId]);
    }
    // Передаем данные админа, чтобы участник знал, к кому он зашел
    io.to(userSocketId).emit("join-approved", { 
        adminName: participants[adminId]?.name,
        adminPeerId: participants[adminId]?.peerId 
    });
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
    if (participants[data.socketId]) participants[data.socketId].isOnAir = false;
    io.emit("mic-revoked", data);
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("disconnect", () => {
    if (participants[socket.id]) {
      delete participants[socket.id];
      delete pendingRequests[socket.id];
      broadcastEvents();
      io.emit("participants-list", Object.values(participants));
    }
  });
});

httpServer.listen(PORT, "0.0.0.0");