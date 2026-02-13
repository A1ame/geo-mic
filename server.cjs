const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer"); // Добавляем это

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("GEO-MIC Server with PeerJS is Live");
});

// Настройка сокетов (оставляем как было, раз работает)
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"], credentials: true },
  transports: ["polling", "websocket"]
});

// Настройка PeerJS сервера внутри вашего приложения
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/peerjs"
});

// Интегрируем Peer сервер
httpServer.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/peerjs")) {
    peerServer.handleUpgrade(request, socket, head);
  }
});

let currentZone = null;

io.on("connection", (socket) => {
  console.log("Клиент подключен:", socket.id);
  if (currentZone) socket.emit("zone-updated", currentZone);

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("join", (data) => {
    console.log(`Пользователь ${data.name} вошел как ${data.role}`);
  });

  socket.on("update-coords", (data) => {
    io.emit("participant-moved", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});