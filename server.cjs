const { Server } = require("socket.io");

// Railway передает порт через переменную PORT
const PORT = process.env.PORT || 3001;

// Создаем сервер БЕЗ указания порта в конструкторе
const io = new Server({
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let currentZone = null;

io.on("connection", (socket) => {
  console.log("Новое подключение:", socket.id);

  if (currentZone) {
    socket.emit("zone-updated", currentZone);
  }

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
    console.log("Зона обновлена:", zone);
  });

  socket.on("raise-hand", (data) => {
    io.emit("new-hand-raised", { 
      id: socket.id, 
      name: data.name, 
      peerId: data.peerId 
    });
  });

  socket.on("give-mic", (data) => {
    io.emit("mic-granted", data); 
  });

  socket.on("update-coords", (data) => {
    io.emit("participant-moved", {
      id: socket.id,
      lat: data.lat,
      lng: data.lng,
      name: data.name
    });
  });

  socket.on("disconnect", () => {
    console.log("Пользователь отключился:", socket.id);
    io.emit("user-disconnected", socket.id);
  });
});

// ПРАВИЛЬНЫЙ запуск для Socket.io на Railway
// Сначала вызываем listen(PORT), а хост 0.0.0.0 Railway подхватит сам
io.listen(parseInt(PORT)); 

console.log(`Сигнальный сервер успешно запущен на порту ${PORT}`);