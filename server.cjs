const { Server } = require("socket.io");
const io = new Server(3001, { cors: { origin: "*" } });

let currentZone = null;
let participants = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Отправляем текущую зону новому пользователю
  if (currentZone) socket.emit("zone-updated", currentZone);

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone); // Рассылаем зону всем
  });

  socket.on("raise-hand", (data) => {
    io.emit("new-hand-raised", { id: socket.id, name: data.name });
  });

  socket.on("give-mic", (peerId) => {
    io.emit("mic-granted", peerId); // Сообщаем участнику, что он в эфире
  });

  socket.on("disconnect", () => {
    participants = participants.filter(p => p.id !== socket.id);
    io.emit("user-disconnected", socket.id);
  });
});

console.log("Signal server running on port 3001");