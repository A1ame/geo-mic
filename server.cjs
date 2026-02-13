const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

// Порт для Railway
const PORT = process.env.PORT || 3000;

// Твой домен фронтенда (БЕЗ слеша в конце)
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer((req, res) => {
  // Базовая проверка работоспособности
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("GEO-MIC Backend is running...");
});

// 1. Настройка Socket.io с исправленным CORS
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ["polling", "websocket"]
});

// 2. Настройка PeerServer
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/peerjs",
  proxied: true, // Обязательно для работы за прокси Railway
  allow_discovery: true,
  corsOptions: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Интеграция PeerServer в HTTP поток
httpServer.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/peerjs")) {
    peerServer.handleUpgrade(request, socket, head);
  }
});

// Хранилище текущей зоны
let currentZone = null;

// Логика Socket.io
io.on("connection", (socket) => {
  console.log("Клиент подключен:", socket.id);
  
  // Отправляем текущую зону новому клиенту
  if (currentZone) {
    socket.emit("zone-updated", currentZone);
  }

  // Админ устанавливает зону
  socket.on("set-zone", (zone) => {
    currentZone = zone;
    console.log("Зона обновлена админом");
    io.emit("zone-updated", zone);
  });

  // Логика входа
  socket.on("join", (data) => {
    console.log(`Пользователь ${data.name} вошел как ${data.role}`);
  });

  // Передача координат
  socket.on("update-coords", (data) => {
    // Рассылаем координаты всем, кроме отправителя
    socket.broadcast.emit("participant-moved", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    console.log("Клиент отключился:", socket.id);
    io.emit("user-disconnected", socket.id);
  });
});

// Запуск сервера
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`>>> Сервер запущен на порту ${PORT}`);
  console.log(`>>> Разрешенный Origin: ${FRONTEND_URL}`);
});