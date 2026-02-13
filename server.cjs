const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server({
  cors: {
    // Разрешаем все источники для тестов, либо укажи свой .vercel.app
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

let currentZone = null;

io.on("connection", (socket) => {
  console.log("Новый пользователь:", socket.id);

  if (currentZone) {
    socket.emit("zone-updated", currentZone);
  }

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("join", (data) => {
    console.log(`Пользователь ${data.name} зашел как ${data.role}`);
  });

  socket.on("update-coords", (data) => {
    io.emit("participant-moved", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
  });
});

// Запуск строго через Number(PORT)
io.listen(Number(PORT));
console.log(`Сигнальный сервер работает на порту ${PORT}`);