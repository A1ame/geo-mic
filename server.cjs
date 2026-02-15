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
let disconnectTimers = {}; // Таймеры для ожидания переподключения админов

const broadcastAll = () => {
  const activeEvents = Object.values(participants)
    .filter(p => p.role === 'admin')
    .map(p => ({ name: p.name, socketId: p.socketId, peerId: p.peerId }));

  io.emit("available-events", activeEvents);
  io.emit("participants-list", Object.values(participants));
};

setInterval(broadcastAll, 3000);

io.on("connection", (socket) => {
  socket.on("join", (data) => {
    // Если этот админ переподключился до истечения 10 секунд, отменяем таймер удаления
    const existingAdmin = Object.values(participants).find(p => p.name === data.name && p.role === 'admin');
    if (existingAdmin && disconnectTimers[existingAdmin.socketId]) {
      clearTimeout(disconnectTimers[existingAdmin.socketId]);
      delete disconnectTimers[existingAdmin.socketId];
      // Удаляем старую запись сокета, так как ID изменился
      delete participants[existingAdmin.socketId];
    }

    const wasOnAir = Object.values(participants).some(p => p.name === data.name && p.isOnAir);
    
    participants[socket.id] = { 
      ...data, 
      socketId: socket.id, 
      handRaised: data.handRaised || false,
      isOnAir: data.isOnAir || wasOnAir 
    };
    broadcastAll();
  });

  // Если админ САМ нажал кнопку "Выйти" - выкидываем всех мгновенно
  socket.on("admin-exit", () => {
    io.emit("event-ended", { adminSocketId: socket.id });
    delete participants[socket.id];
    broadcastAll();
  });

  socket.on("disconnect", () => {
    const p = participants[socket.id];
    if (p && p.role === 'admin') {
      // Вместо мгновенного удаления, ждем 10 секунд (на случай F5)
      disconnectTimers[socket.id] = setTimeout(() => {
        io.emit("event-ended", { adminSocketId: socket.id });
        delete participants[socket.id];
        delete disconnectTimers[socket.id];
        broadcastAll();
      }, 10000); // 10 секунд задержки
    } else {
      delete participants[socket.id];
      broadcastAll();
    }
  });

  // Остальные методы (approve-user, give-mic, revoke-mic, raise-hand) остаются без изменений
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

  socket.on("request-join", (data) => {
    const { adminSocketId, name, peerId } = data;
    if (!pendingRequests[adminSocketId]) pendingRequests[adminSocketId] = [];
    if (!pendingRequests[adminSocketId].find(r => r.peerId === peerId)) {
      pendingRequests[adminSocketId].push({ name, socketId: socket.id, peerId });
    }
    io.to(adminSocketId).emit("new-request", pendingRequests[adminSocketId]);
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

  socket.on("raise-hand", () => {
    if (participants[socket.id]) {
      participants[socket.id].handRaised = true;
      participants[socket.id].isOnAir = false;
      broadcastAll();
    }
  });
});

httpServer.listen(PORT, "0.0.0.0");