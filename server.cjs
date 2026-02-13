const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

const io = new Server({
  cors: {
    origin: "*", // Позже здесь лучше прописать https://geo-mic.vercel.app
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true, // Для обратной совместимости
  transports: ['websocket', 'polling'] 
});

let currentZone = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  if (currentZone) socket.emit("zone-updated", currentZone);

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("join", (data) => {
    console.log(`User ${data.name} joined as ${data.role}`);
  });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
  });
});

// На Railway крайне важно просто слушать PORT без лишних параметров
io.listen(parseInt(PORT)); 
console.log(`Server running on port ${PORT}`);