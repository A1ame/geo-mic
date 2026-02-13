const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer(app);

// Настройка Socket.io с расширенным CORS
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:5173"], // Разрешаем фронт и локалку
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"]
});

// Настройка PeerServer
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/",
  proxied: true,
  allow_discovery: true,
  // Добавляем CORS специфично для PeerJS (исправляет image_a61856.png)
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

  socket.on("join", (data) => {
    console.log(`User ${data.name} joined as ${data.role}`);
    socket.join("main-room"); // Группируем пользователей
  });

  // Админ устанавливает зону (центр и радиус)
  socket.on("set-zone", (zone) => {
    console.log("Zone updated:", zone);
    io.emit("zone-updated", zone); // Рассылаем всем участникам
  });

  // Участник передает свои координаты
  socket.on("update-coords", (data) => {
    // Рассылаем координаты всем, кроме отправителя
    socket.broadcast.emit("participant-moved", { 
      id: socket.id, 
      ...data 
    });
  });

  // Логика передачи микрофона
  socket.on("raise-hand", (data) => {
    // Передаем админу инфо о том, что кто-то хочет говорить
    io.emit("new-hand-raised", { 
      id: socket.id, 
      name: data.name, 
      peerId: data.peerId 
    });
  });

  socket.on("give-mic", (data) => {
    // Сообщаем конкретному пользователю, что ему дали микрофон
    io.emit("mic-granted", { 
      targetPeerId: data.targetPeerId, 
      adminPeerId: data.adminPeerId 
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    io.emit("user-disconnected", socket.id);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});