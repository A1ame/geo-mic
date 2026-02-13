const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app"; // Укажи свой домен без слеша в конце

const httpServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("GEO-MIC Server is Live");
});

// Настройка Socket.io с конкретным origin
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ["polling", "websocket"]
});

// Настройка PeerServer с конкретным origin
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/peerjs",
  proxied: true,
  allow_discovery: true,
  corsOptions: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/peerjs")) {
    peerServer.handleUpgrade(request, socket, head);
  }
});

// ... (остальной код io.on('connection') остается без изменений)

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});