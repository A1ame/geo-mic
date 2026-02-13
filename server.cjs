const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

// Создаем обычный HTTP сервер — Railway это любит больше
const httpServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Сигнальный сервер GEO-MIC активен");
});

const io = new Server(httpServer, {
  cors: {
    // Разрешаем вообще всё на время тестов, чтобы точно исключить CORS
    origin: true, 
    methods: ["GET", "POST"],
    credentials: true
  },
  // Принудительно разрешаем долгие опросы, если WebSockets блокируются
  transports: ["polling", "websocket"]
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

// Слушаем на 0.0.0.0 — это критично для внешних подключений
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});