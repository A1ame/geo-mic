const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

// Создаем HTTP сервер, чтобы Railway легче было его проксировать
const httpServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("GEO-MIC Signal Server is Running");
});

const io = new Server(httpServer, {
  cors: {
    origin: true, // Разрешает запросы с любого домена (решает проблему CORS)
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ["polling", "websocket"] // Важно оставить оба
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

// Слушаем на 0.0.0.0 — это критично для облачных хостингов
httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});