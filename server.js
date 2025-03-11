const express = require("express");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// Global CORS middleware for Express routes
app.use(cors({
  origin: "https://nkomode.com",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

const server = createServer(app);

// Initialize Socket.IO with explicit CORS configuration
const io = new Server(server, {
  cors: {
    origin: "https://nkomode.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }
});

// Create the PeerJS server instance
const peerServer = ExpressPeerServer(server, {
  path: "/",
  allow_discovery: true,
  debug: true
});

// Apply CORS specifically to the PeerJS endpoint
app.use("/peerjs", cors({
  origin: "https://nkomode.com",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}), peerServer);

// Variables for matchmaking
const waitingUsers = [];
const connectedPeers = new Set();

// PeerJS connection events
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

// Socket.IO events for matchmaking
io.on("connection", (socket) => {
  console.log(`✅ A user connected: ${socket.id}`);
  connectedPeers.add(socket.id);
  updatePeerCount();

  socket.on("find_match", (peerId) => {
    console.log(`🟢 User ${peerId} is searching for a match...`);

    if (waitingUsers.length > 0) {
      // FIFO: match the longest waiting user first
      const matchedUser = waitingUsers.shift();
      console.log(`🔗 Pairing ${peerId} with ${matchedUser.peerId}`);
      io.to(socket.id).emit("match_found", matchedUser.peerId);
      io.to(matchedUser.socketId).emit("match_found", peerId);
    } else {
      // Add the user to the waiting queue
      waitingUsers.push({ peerId, socketId: socket.id, timestamp: Date.now() });
      console.log(`🕒 ${peerId} added to waiting list`);
    }
    updateQueueCount();
  });

  // Auto-matchmaking every 10 seconds
  const matchInterval = setInterval(() => {
    if (waitingUsers.length > 1) {
      const user1 = waitingUsers.shift();
      const user2 = waitingUsers.shift();
      console.log(`🔄 Auto-matching ${user1.peerId} with ${user2.peerId}`);
      io.to(user1.socketId).emit("match_found", user2.peerId);
      io.to(user2.socketId).emit("match_found", user1.peerId);
    }
    updateQueueCount();
  }, 10000);

  socket.on("disconnect", () => {
    console.log(`❌ A user disconnected: ${socket.id}`);
    connectedPeers.delete(socket.id);
    updatePeerCount();

    // Remove user from waiting queue if present
    const index = waitingUsers.findIndex(user => user.socketId === socket.id);
    if (index !== -1) {
      console.log(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
      waitingUsers.splice(index, 1);
    }
    updateQueueCount();

    // Clear auto-match interval if no users remain
    if (waitingUsers.length === 0) {
      clearInterval(matchInterval);
    }
  });
});

// Helper functions to emit counts
function updatePeerCount() {
  const peerCount = connectedPeers.size;
  io.emit("peer_count", peerCount);
  console.log(`👥 Total Connected Peers: ${peerCount}`);
}

function updateQueueCount() {
  const queueCount = waitingUsers.length;
  io.emit("queue_count", queueCount);
  console.log(`⌛ Users Waiting in Queue: ${queueCount}`);
}

// Start the server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
