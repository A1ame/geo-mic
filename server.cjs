const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

// Создаем основной сервер
const httpServer = http.createServer((req, res) => {
  // CORS заголовки для обычных запросов
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Отвечаем "Live" только на корень, чтобы не мешать PeerJS
  if (req.url === "/" || req.url === "") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("GEO-MIC Backend is running...");
    return;
  }
});

// Настройка Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"]
});

// Настройка PeerServer
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/", // Путь внутри /peerjs, который мы укажем в httpServer.on('upgrade')
  proxied: true,
  allow_discovery: true,
  corsOptions: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Обработка Upgrade для PeerJS
httpServer.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/peerjs")) {
    peerServer.handleUpgrade(request, socket, head);
  }
});

// Логика Socket.io
let currentZone = null;
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  if (currentZone) socket.emit("zone-updated", currentZone);

  socket.on("set-zone", (zone) => {
    currentZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("join", (data) => {
    console.log(`User ${data.name} joined as ${data.role}`);
  });

  socket.on("update-coords", (data) => {
    socket.broadcast.emit("participant-moved", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});