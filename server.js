const express = require("express");
const cors = require("cors");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();

// Global middleware to set CORS headers on every request
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins; or use "https://nkomode.com"
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Also use the cors package as needed
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // or restrict to "https://nkomode.com"
    methods: ["GET", "POST"]
  }
});

// Create the PeerJS server instance.
// Note: We set the path to "/" so that when we mount it at "/peerjs",
// the effective endpoint will be "https://yourdomain/peerjs/..."
const peerServer = ExpressPeerServer(server, {
  path: "/",
  allow_discovery: true,
  debug: true
});

// Mount the PeerJS server under the "/peerjs" route.
app.use("/peerjs", peerServer);

// Define your matchmaking queues and connected peer tracking.
const waitingMen = [];
const waitingWomen = [];
const connectedPeers = new Set(); // Stores all connected peer IDs

// Log PeerJS connections
peerServer.on("connection", (client) => {
  console.log(`🟢 New Peer connected: ${client.getId()}`);
  connectedPeers.add(client.getId());
  updatePeerCount(); // Update total peer count
});

peerServer.on("disconnect", (client) => {
  console.log(`🔴 Peer disconnected: ${client.getId()}`);
  connectedPeers.delete(client.getId());
  updatePeerCount(); // Update total peer count
});

// Socket.io connection for matchmaking and messaging
io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);
  connectedPeers.add(socket.id);
  updatePeerCount(); // Logs and updates peer count

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
    updateQueueCount(); // Log updated queue count
  });

  socket.on("disconnect", () => {
    console.log(`❌ A user disconnected: ${socket.id}`);
    connectedPeers.delete(socket.id);
    updatePeerCount(); // Logs and updates peer count

    // Remove user from waiting lists if present
    removeUserFromQueue(socket.id);
    updateQueueCount(); // Log updated queue count
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
