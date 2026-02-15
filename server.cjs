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
  io.emit("available-events", activeEvents);
};

io.on("connection", (socket) => {
  // Исправление: отправляем список событий сразу при входе
  broadcastEvents();

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
    if (pendingRequests[socket.id]) {
      pendingRequests[socket.id] = pendingRequests[socket.id].filter(r => r.socketId !== userSocketId);
      io.to(socket.id).emit("new-request", pendingRequests[socket.id]);
    }
    io.to(userSocketId).emit("join-approved", { adminSocketId: socket.id });
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
    delete participants[socket.id];
    delete pendingRequests[socket.id];
    broadcastEvents();
    io.emit("participants-list", Object.values(participants));
  });
});

httpServer.listen(PORT, "0.0.0.0");