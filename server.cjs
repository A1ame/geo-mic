const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer(app);

// Хранилище активного события для синхронизации "запоздавших"
let activeZone = null; 

const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"]
});

const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/",
  proxied: true,
  allow_discovery: true,
  corsOptions: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.send("GEO-MIC Backend is Online");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // СИНХРОНИЗАЦИЯ: Если кто-то зашел, а зона уже создана — сразу отправляем её
  if (activeZone) {
    socket.emit("zone-updated", activeZone);
  }

  socket.on("join", (data) => {
    console.log(`User ${data.name} joined as ${data.role}`);
    socket.join("main-room");
  });

  // Админ устанавливает зону
  socket.on("set-zone", (zone) => {
    activeZone = zone; // ЗАПОМИНАЕМ ЗОНУ НА СЕРВЕРЕ
    console.log("Zone updated and stored:", zone);
    io.emit("zone-updated", zone); 
  });

  // Логика передачи микрофона
  socket.on("raise-hand", (data) => {
    // Добавляем флаг handRaised для админа
    io.emit("new-hand-raised", { 
      id: socket.id, 
      name: data.name, 
      peerId: data.peerId,
      handRaised: true 
    });
  });

  socket.on("give-mic", (data) => {
    io.emit("mic-granted", { 
      targetPeerId: data.targetPeerId, 
      adminPeerId: data.adminPeerId 
    });
  });

  // НОВОЕ: Команда на отключение микрофона (Revoke)
  socket.on("revoke-mic", (data) => {
    console.log("Revoking mic from:", data.targetPeerId);
    io.emit("mic-revoked", { 
      targetPeerId: data.targetPeerId 
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    io.emit("user-disconnected", socket.id);
    
    // Опционально: если нужно удалять зону, когда админ уходит
    // activeZone = null; 
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});