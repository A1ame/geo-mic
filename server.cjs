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

const getActiveEvents = () => {
  return Object.values(participants)
    .filter(p => p.role === 'admin')
    .map(p => ({ name: p.name, socketId: p.socketId, peerId: p.peerId }));
};

const broadcastAll = () => {
  io.emit("available-events", getActiveEvents());
  io.emit("participants-list", Object.values(participants));
};

// МАЯК: Рассылаем события каждые 2 сек, чтобы новые участники видели их сразу
setInterval(broadcastAll, 2000);

io.on("connection", (socket) => {
  socket.on("join", (data) => {
    // Удаляем старые записи с тем же PeerID (защита от дублей при перезагрузке)
    Object.keys(participants).forEach(id => {
      if (participants[id].peerId === data.peerId) delete participants[id];
    });

    participants[socket.id] = { ...data, socketId: socket.id, handRaised: false, isOnAir: false };
    broadcastAll();
  });

  socket.on("request-join", (data) => {
    const { adminSocketId, name, peerId } = data;
    if (!pendingRequests[adminSocketId]) pendingRequests[adminSocketId] = [];
    if (!pendingRequests[adminSocketId].find(r => r.peerId === peerId)) {
      pendingRequests[adminSocketId].push({ name, socketId: socket.id, peerId });
    }
    io.to(adminSocketId).emit("new-request", pendingRequests[adminSocketId]);
  });

  socket.on("approve-user", (userSocketId) => {
    const adminId = socket.id;
    if (pendingRequests[adminId]) {
      pendingRequests[adminId] = pendingRequests[adminId].filter(r => r.socketId !== userSocketId);
      io.to(adminId).emit("new-request", pendingRequests[adminId]);
    }
    io.to(userSocketId).emit("join-approved", { 
        adminName: participants[adminId]?.name,
        adminPeerId: participants[adminId]?.peerId 
    });
  });

  socket.on("stop-event", () => {
    delete participants[socket.id];
    delete pendingRequests[socket.id];
    broadcastAll();
  });

  socket.on("raise-hand", () => {
    if (participants[socket.id]) {
      participants[socket.id].handRaised = true;
      broadcastAll();
    }
  });

  socket.on("give-mic", (data) => {
    if (participants[data.socketId]) {
      participants[data.socketId].isOnAir = true;
      participants[data.socketId].handRaised = false;
    }
    io.emit("mic-granted", data);
    broadcastAll();
  });

  socket.on("revoke-mic", (data) => {
    if (participants[data.socketId]) participants[data.socketId].isOnAir = false;
    io.emit("mic-revoked", data);
    broadcastAll();
  });

  socket.on("disconnect", () => {
    setTimeout(() => {
      if (!io.sockets.sockets.get(socket.id)) {
        delete participants[socket.id];
        delete pendingRequests[socket.id];
        broadcastAll();
      }
    }, 3000);
  });
});

httpServer.listen(PORT, "0.0.0.0");