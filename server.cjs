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
let disconnectTimers = {};
// Хранилище состояний для восстановления после перезагрузки
let persistentStates = {}; 

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
    // Проверяем, есть ли сохраненное состояние для этого имени
    const stateKey = `${data.role}_${data.name}`;
    const savedState = persistentStates[stateKey];

    // Очищаем старые сокеты с таким же именем
    Object.keys(participants).forEach(id => {
      if (participants[id].name === data.name && participants[id].role === data.role) {
        delete participants[id];
      }
    });

    participants[socket.id] = { 
      ...data, 
      socketId: socket.id, 
      handRaised: data.handRaised || false,
      // Если был в эфире до F5 - восстанавливаем статус
      isOnAir: savedState ? savedState.isOnAir : (data.isOnAir || false)
    };

    // Если восстановили "в эфире", уведомляем всех о новом peerId участника
    if (participants[socket.id].isOnAir) {
      io.emit("mic-granted", { 
        socketId: socket.id, 
        peerId: data.peerId,
        adminPeerId: savedState?.adminPeerId 
      });
    }

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
        adminPeerId: participants[adminId]?.peerId,
        adminSocketId: adminId
    });
  });

  socket.on("give-mic", (data) => {
    if (participants[data.socketId]) {
      participants[data.socketId].isOnAir = true;
      participants[data.socketId].handRaised = false;
      // Сохраняем в долгосрочную память
      const key = `user_${participants[data.socketId].name}`;
      persistentStates[key] = { isOnAir: true, adminPeerId: data.adminPeerId };
    }
    io.emit("mic-granted", data);
    broadcastAll();
  });

  socket.on("revoke-mic", (data) => {
    if (participants[data.socketId]) {
      participants[data.socketId].isOnAir = false;
      const key = `user_${participants[data.socketId].name}`;
      delete persistentStates[key];
    }
    io.emit("mic-revoked", data);
    broadcastAll();
  });

  socket.on("admin-exit", () => {
    io.emit("event-ended", { adminSocketId: socket.id });
    delete participants[socket.id];
    broadcastAll();
  });

  socket.on("disconnect", () => {
    const p = participants[socket.id];
    if (p) {
      const stateKey = `${p.role}_${p.name}`;
      // Если это админ - ждем 10 сек
      if (p.role === 'admin') {
        disconnectTimers[socket.id] = setTimeout(() => {
          io.emit("event-ended", { adminSocketId: socket.id });
          delete participants[socket.id];
          broadcastAll();
        }, 10000);
      } else {
        // Если это юзер - сохраняем его isOnAir на 5 сек, чтобы кнопка не мигала
        if (p.isOnAir) {
           persistentStates[stateKey] = { isOnAir: true };
           setTimeout(() => { delete persistentStates[stateKey]; }, 5000);
        }
        delete participants[socket.id];
        broadcastAll();
      }
    }
  });
});

httpServer.listen(PORT, "0.0.0.0");