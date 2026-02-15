const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = "https://geo-mic.vercel.app";

const httpServer = http.createServer(app);

let activeZone = null;
let participants = {}; // Хранилище активных участников

const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling", "websocket"]
});

const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: "/",
  proxied: true,
  allow_discovery: true,
  corsOptions: { origin: FRONTEND_URL, methods: ["GET", "POST"] }
});

app.use("/peerjs", peerServer);

app.get("/", (req, res) => { res.send("GEO-MIC Backend is Online"); });

io.on("connection", (socket) => {
  if (activeZone) socket.emit("zone-updated", activeZone);

  socket.on("join", (data) => {
    participants[socket.id] = { ...data, id: socket.id };
    socket.join("main-room");
    // Отправляем админу обновленный список сразу
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("set-zone", (zone) => {
    activeZone = zone;
    io.emit("zone-updated", zone);
  });

  socket.on("stop-event", () => {
    activeZone = null;
    io.emit("zone-updated", null);
  });

  socket.on("update-coords", (data) => {
    if (participants[socket.id]) {
      participants[socket.id].coords = data.coords;
      io.emit("participants-list", Object.values(participants));
    }
  });

  socket.on("raise-hand", (data) => {
    io.emit("new-hand-raised", { ...data, id: socket.id, handRaised: true });
  });

  socket.on("give-mic", (data) => {
    io.emit("mic-granted", data);
  });

  socket.on("revoke-mic", (data) => {
    io.emit("mic-revoked", data);
  });

  socket.on("leave", () => {
    delete participants[socket.id];
    io.emit("participants-list", Object.values(participants));
  });

  socket.on("disconnect", () => {
    delete participants[socket.id];
    io.emit("participants-list", Object.values(participants));
  });
});

httpServer.listen(PORT, "0.0.0.0", () => { console.log(`Server started on port ${PORT}`); });