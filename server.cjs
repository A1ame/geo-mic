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
  }
});

// Настройка PeerServer как middleware Express
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/",
  proxied: true
});

// Маршруты
app.use("/peerjs", peerServer);

app.get("/", (req, res) => {
  res.send("GEO-MIC Server is Running");
});

// Логика Socket.io
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  
  socket.on("join", (data) => {
    console.log(`User ${data.name} joined`);
  });

  socket.on("set-zone", (zone) => {
    socket.broadcast.emit("zone-updated", zone);
  });

  socket.on("update-coords", (data) => {
    socket.broadcast.emit("participant-moved", { id: socket.id, ...data });
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});