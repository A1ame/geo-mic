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
let persistentStates = {}; // Ключ: role_name. Хранит isOnAir и handRaised.

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
    const stateKey = `${data.role}_${data.name}`;
    const savedState = persistentStates[stateKey];

    // Очистка старых подключений с тем же именем
    Object.keys(participants).forEach(id => {
      if (participants[id].name === data.name && participants[id].role === data.role) {
        delete participants[id];
      }
    });

    // Создаем запись участника, приоритет отдаем сохраненному состоянию (для F5)
    participants[socket.id] = { 
      ...data, 
      socketId: socket.id, 
      handRaised: savedState ? savedState.handRaised : (data.handRaised || false),
      isOnAir: savedState ? savedState.isOnAir : (data.isOnAir || false)
    };

    // Если участник восстановился и он был в эфире, уведомляем админа, чтобы он ждал поток
    if (participants[socket.id].isOnAir) {
      io.emit("mic-granted", { 
        socketId: socket.id, 
        peerId: data.peerId,
        adminPeerId: savedState?.adminPeerId 
      });
    }

    broadcastAll();
  });

  socket.on("raise-hand", () => {
    if (participants[socket.id]) {
      participants[socket.id].handRaised = true;
      participants[socket.id].isOnAir = false;
      const stateKey = `user_${participants[socket.id].name}`;
      persistentStates[stateKey] = { handRaised: true, isOnAir: false };
      broadcastAll();
    }
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
      const stateKey = `user_${participants[data.socketId].name}`;
      persistentStates[stateKey] = { isOnAir: true, handRaised: false, adminPeerId: data.adminPeerId };
    }
    io.emit("mic-granted", data);
    broadcastAll();
  });

  socket.on("revoke-mic", (data) => {
    if (participants[data.socketId]) {
      participants[data.socketId].isOnAir = false;
      const stateKey = `user_${participants[data.socketId].name}`;
      delete persistentStates[stateKey];
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
      // Оставляем состояние в persistentStates на 10 секунд для F5
      const stateKey = `${p.role}_${p.name}`;
      if (p.isOnAir || p.handRaised) {
        setTimeout(() => {
          // Если за 10 сек никто не зашел с этим именем, удаляем окончательно
          const stillExists = Object.values(participants).some(curr => curr.name === p.name);
          if (!stillExists) delete persistentStates[stateKey];
        }, 10000);
      }
      delete participants[socket.id];
      broadcastAll();
    }
  });
});

httpServer.listen(PORT, "0.0.0.0");