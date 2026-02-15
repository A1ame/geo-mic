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
let activeZone = null; 

const broadcastAll = () => {
  const activeEvents = Object.values(participants)
    .filter(p => p.role === 'admin')
    .map(p => ({ name: p.name, socketId: p.socketId, peerId: p.peerId }));

  io.emit("available-events", activeEvents);
  io.emit("participants-list", Object.values(participants));
};

// Маяк для новых участников
setInterval(broadcastAll, 3000);

io.on("connection", (socket) => {
  if (activeZone) socket.emit("zone-updated", activeZone);

  socket.on("join", (data) => {
    // УДАЛЕНИЕ ДУБЛИКАТОВ (по имени или PeerID)
    Object.keys(participants).forEach(id => {
      if (participants[id].name === data.name || participants[id].peerId === data.peerId) {
        delete participants[id];
      }
    });

    participants[socket.id] = { ...data, socketId: socket.id, handRaised: false, isOnAir: false };
    broadcastAll();
  });

  socket.on("set-zone", (zone) => {
    activeZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("request-join", (data) => {
    const { adminSocketId, name, peerId } = data;
    // Если админа нет в списке участников, игнорируем запрос
    if (!participants[adminSocketId]) return;

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
        adminPeerId: participants[adminId]?.peerId,
        adminSocketId: adminId
    });
  });

  socket.on("stop-event", () => {
    activeZone = null;
    io.emit("zone-updated", null);
    delete participants[socket.id];
    broadcastAll();
  });

  socket.on("update-coords", (data) => {
    if (participants[socket.id]) {
      participants[socket.id].coords = data.coords;
      io.emit("participants-list", Object.values(participants));
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
        if (participants[socket.id]?.role === 'admin') activeZone = null;
        delete participants[socket.id];
        delete pendingRequests[socket.id];
        broadcastAll();
      }
    }, 3000);
  });
});

httpServer.listen(PORT, "0.0.0.0");