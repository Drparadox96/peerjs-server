const express = require("express");
const cors = require("cors");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();

// Global CORS middleware for all routes (restrict to https://nkomode.com)
app.use(cors({
  origin: "https://nkomode.com",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Content-Length", "X-Requested-With"]
}));

// Apply CORS headers to every request under /peerjs/*
app.all("/peerjs/*", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://nkomode.com");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://nkomode.com",
    methods: ["GET", "POST"]
  }
});

// Create PeerJS server with internal path "/" and mount it at /peerjs
const peerServer = ExpressPeerServer(server, {
  path: "/",
  allow_discovery: true,
  debug: true
});
app.use("/peerjs", peerServer);

// --- Socket.io / Matchmaking Logic ---
const waitingMen = [];
const waitingWomen = [];
const connectedPeers = new Set(); // Stores all connected peer IDs

// Log PeerJS connections
peerServer.on("connection", (client) => {
  console.log(`🟢 New Peer connected: ${client.getId()}`);
  connectedPeers.add(client.getId());
  updatePeerCount();
});

peerServer.on("disconnect", (client) => {
  console.log(`🔴 Peer disconnected: ${client.getId()}`);
  connectedPeers.delete(client.getId());
  updatePeerCount();
});

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);
  connectedPeers.add(socket.id);
  updatePeerCount();

  socket.on("find_match", (peerId, gender) => {
    console.log(`🟢 User ${peerId} (${gender}) is searching for a match...`);

    if (gender === "male" && waitingWomen.length > 0) {
      const matchedUser = waitingWomen.shift();
      matchUsers(peerId, socket.id, matchedUser.peerId, matchedUser.socketId);
    } else if (gender === "female" && waitingMen.length > 0) {
      const matchedUser = waitingMen.shift();
      matchUsers(peerId, socket.id, matchedUser.peerId, matchedUser.socketId);
    } else {
      // Add user to the respective queue
      if (gender === "male") {
        waitingMen.push({ peerId, socketId: socket.id });
      } else {
        waitingWomen.push({ peerId, socketId: socket.id });
      }
      console.log(`🕒 ${peerId} added to ${gender === "male" ? "male" : "female"} waiting list`);
    }
    updateQueueCount();
  });

  socket.on("disconnect", () => {
    console.log(`❌ A user disconnected: ${socket.id}`);
    connectedPeers.delete(socket.id);
    updatePeerCount();
    removeUserFromQueue(socket.id);
    updateQueueCount();
  });
});

function matchUsers(peerId1, socketId1, peerId2, socketId2) {
  console.log(`🔗 Pairing ${peerId1} with ${peerId2}`);
  io.to(socketId1).emit("match_found", peerId2);
  io.to(socketId2).emit("match_found", peerId1);
}

function removeUserFromQueue(socketId) {
  let index = waitingMen.findIndex(user => user.socketId === socketId);
  if (index !== -1) waitingMen.splice(index, 1);

  index = waitingWomen.findIndex(user => user.socketId === socketId);
  if (index !== -1) waitingWomen.splice(index, 1);
}

function updatePeerCount() {
  const peerCount = connectedPeers.size;
  io.emit("peer_count", peerCount);
  console.log(`👥 Total Connected Peers: ${peerCount}`);
}

function updateQueueCount() {
  console.log(`⌛ Users Waiting - Men: ${waitingMen.length}, Women: ${waitingWomen.length}`);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
