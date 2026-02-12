const { Server } = require("socket.io");

// Railway сам подставит нужный порт в переменную PORT
const PORT = process.env.PORT || 3001;

const io = new Server({
  cors: {
    origin: "*", // Разрешаем доступ со всех доменов (включая Vercel)
    methods: ["GET", "POST"]
  }
});

let currentZone = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  if (currentZone) {
    socket.emit("zone-updated", currentZone);
  }

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
  });

  // Участник нажимает кнопку "Поднять руку"
  socket.on("raise-hand", (data) => {
    // Отправляем админу socket.id и peerId участника
    io.emit("new-hand-raised", { 
      id: socket.id, 
      name: data.name, 
      peerId: data.peerId 
    });
  });

  // Админ нажимает "Дать микрофон"
  socket.on("give-mic", (data) => {
    // data должна содержать { targetPeerId, adminPeerId }
    io.emit("mic-granted", data); 
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    io.emit("user-disconnected", socket.id);
  });
});

io.listen(PORT);
console.log(`Signal server running on port ${PORT}`);