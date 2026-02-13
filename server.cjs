const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer(app);

// Настройка Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"] // Важно для стабильности
});

// Настройка PeerServer как middleware
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/",
  proxied: true,
  allow_discovery: true
});

// Подключаем PeerJS по пути /peerjs
app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.send("GEO-MIC Backend is Online");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (data) => {
    console.log(`User ${data.name} joined as ${data.role}`);
  });

  socket.on("set-zone", (zone) => {
    io.emit("zone-updated", zone);
  });

  socket.on("update-coords", (data) => {
    socket.broadcast.emit("participant-moved", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    io.emit("user-disconnected", socket.id);
  });
});

// Запуск
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server started on port ${PORT}`);
});