const { Server } = require("socket.io");

// Railway автоматически передает PORT. Если нет — используем 3001
const PORT = process.env.PORT || 3001;

const io = new Server({
  cors: {
    origin: "*", // Разрешаем подключения со всех адресов (Vercel)
    methods: ["GET", "POST"]
  }
});

let currentZone = null;

io.on("connection", (socket) => {
  console.log("Новое подключение:", socket.id);

  // Если зона уже создана админом, сразу отправляем её новичку
  if (currentZone) {
    socket.emit("zone-updated", currentZone);
  }

  // Обновление зоны (от админа)
  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
    console.log("Зона обновлена:", zone);
  });

  // Участник поднял руку
  socket.on("raise-hand", (data) => {
    // Рассылаем всем (админ поймает это событие)
    io.emit("new-hand-raised", { 
      id: socket.id, 
      name: data.name, 
      peerId: data.peerId 
    });
  });

  // Админ дает микрофон конкретному PeerID
  socket.on("give-mic", (data) => {
    // data содержит { targetPeerId, adminPeerId }
    io.emit("mic-granted", data); 
  });

  // Обновление координат для карты админа
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

// Запуск на 0.0.0.0 обязателен для Railway, чтобы принимать внешний трафик
io.listen(PORT, "0.0.0.0");
console.log(`Сигнальный сервер запущен на порту ${PORT}`);