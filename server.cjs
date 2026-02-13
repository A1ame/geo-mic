const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/" || req.url === "") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Backend is running");
    return;
  }
});

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"], credentials: true },
  transports: ["polling", "websocket"]
});

const peerServer = ExpressPeerServer(httpServer, {
  path: "/",
  proxied: true,
  corsOptions: { origin: FRONTEND_URL, methods: ["GET", "POST"], credentials: true }
});

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith("/peerjs")) {
    peerServer.handleUpgrade(request, socket, head);
  }
});

io.on("connection", (socket) => {
  socket.on("join", (data) => console.log(`User ${data.name} joined`));
  socket.on("set-zone", (zone) => io.emit("zone-updated", zone));
  socket.on("update-coords", (data) => socket.broadcast.emit("participant-moved", { id: socket.id, ...data }));
});

httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server on port ${PORT}`));