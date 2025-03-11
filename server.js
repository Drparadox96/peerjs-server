const express = require("express");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const peerServer = ExpressPeerServer(server, {
    path: "/",
    allow_discovery: true,
    debug: true
});

app.use("/peerjs", cors(), peerServer);

const waitingUsers = [];
const connectedPeers = new Set(); // Stores all connected peer IDs

// ✅ PeerJS Connection Logging
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

io.on("connection", (socket) => {
    console.log(`✅ A user connected: ${socket.id}`);
    connectedPeers.add(socket.id);
    updatePeerCount(); // Logs and updates peer count

    socket.on("find_match", (peerId) => {
        console.log(`🟢 User ${peerId} is searching for a match...`);

        if (waitingUsers.length > 0) {
            // FIFO: Match the longest waiting user first
            const matchedUser = waitingUsers.shift();
            console.log(`🔗 Pairing ${peerId} with ${matchedUser.peerId}`);

            io.to(socket.id).emit("match_found", matchedUser.peerId);
            io.to(matchedUser.socketId).emit("match_found", peerId);
        } else {
            // Add user to queue
            waitingUsers.push({ peerId, socketId: socket.id, timestamp: Date.now() });
            console.log(`🕒 ${peerId} added to waiting list`);
        }
        updateQueueCount(); // Log updated queue count
    });

    // 🔥 Auto-matchmaking every 10 seconds
    const matchInterval = setInterval(() => {
        if (waitingUsers.length > 1) {
            const user1 = waitingUsers.shift();
            const user2 = waitingUsers.shift();
            console.log(`🔄 Auto-matching ${user1.peerId} with ${user2.peerId}`);

            io.to(user1.socketId).emit("match_found", user2.peerId);
            io.to(user2.socketId).emit("match_found", user1.peerId);
        }
        updateQueueCount(); // Log updated queue count
    }, 10000);

    socket.on("disconnect", () => {
        console.log(`❌ A user disconnected: ${socket.id}`);
        connectedPeers.delete(socket.id);
        updatePeerCount(); // Logs and updates peer count

        // Remove user from waiting list
        const index = waitingUsers.findIndex(user => user.socketId === socket.id);
        if (index !== -1) {
            console.log(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
            waitingUsers.splice(index, 1);
        }
        updateQueueCount(); // Log updated queue count

        // Stop auto-matching if no users left
        if (waitingUsers.length === 0) {
            clearInterval(matchInterval);
        }
    });
});

// ✅ Function to update and log connected peers count
function updatePeerCount() {
    const peerCount = connectedPeers.size;
    io.emit("peer_count", peerCount);
    console.log(`👥 Total Connected Peers: ${peerCount}`);
}

// ✅ Function to update and log queue count
function updateQueueCount() {
    const queueCount = waitingUsers.length;
    io.emit("queue_count", queueCount);
    console.log(`⌛ Users Waiting in Queue: ${queueCount}`);
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
