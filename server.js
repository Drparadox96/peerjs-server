const express = require("express");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Global CORS configuration for all routes
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const corsOptions = {
  origin: "*", // or restrict to 'https://nkomode.com' if preferred
  methods: ["GET", "POST"]
};

// Wrap the PeerJS route with CORS middleware
const peerServer = ExpressPeerServer(server, {
  path: "/",
  allow_discovery: true,
  debug: true
});
app.use("/peerjs", cors(corsOptions), peerServer);

const waitingUsers = [];
const connectedPeers = new Set();

// PeerJS connection logging
peerServer.on("connection", (client) => {
  const id = client.getId();
  console.log(`🟢 New Peer connected: ${id}`);
  connectedPeers.add(id);
  updatePeerCount();
});

peerServer.on("disconnect", (client) => {
  const id = client.getId();
  console.log(`🔴 Peer disconnected: ${id}`);
  connectedPeers.delete(id);
  updatePeerCount();
});

// Global auto-match interval running every 10 seconds
const autoMatchInterval = setInterval(() => {
  while (waitingUsers.length > 1) {
    const user1 = waitingUsers.shift();
    const user2 = waitingUsers.shift();
    console.log(`🔄 Auto-matching ${user1.peerId} with ${user2.peerId}`);
    io.to(user1.socketId).emit("match_found", user2.peerId);
    io.to(user2.socketId).emit("match_found", user1.peerId);
  }
  updateQueueCount();
}, 10000);

io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);
  connectedPeers.add(socket.id);
  updatePeerCount();

  socket.on("find_match", (peerId) => {
    console.log(`🟢 User ${peerId} is searching for a match...`);
    if (waitingUsers.length > 0) {
      const matchedUser = waitingUsers.shift();
      console.log(`🔗 Pairing ${peerId} with ${matchedUser.peerId}`);
      io.to(socket.id).emit("match_found", matchedUser.peerId);
      io.to(matchedUser.socketId).emit("match_found", peerId);
    } else {
      waitingUsers.push({ peerId, socketId: socket.id, timestamp: Date.now() });
      console.log(`🕒 ${peerId} added to waiting list`);
    }
    updateQueueCount();
  });

  socket.on("disconnect", () => {
    console.log(`❌ A user disconnected: ${socket.id}`);
    connectedPeers.delete(socket.id);
    updatePeerCount();

    // Remove user from waiting list if present
    const index = waitingUsers.findIndex(user => user.socketId === socket.id);
    if (index !== -1) {
      console.log(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
      waitingUsers.splice(index, 1);
      updateQueueCount();
    }
  });
});

function updatePeerCount() {
  const count = connectedPeers.size;
  io.emit("peer_count", count);
  console.log(`👥 Total Connected Peers: ${count}`);
}

function updateQueueCount() {
  const count = waitingUsers.length;
  io.emit("queue_count", count);
  console.log(`⌛ Users Waiting in Queue: ${count}`);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ PeerJS Server is running on port ${PORT}`);
});
