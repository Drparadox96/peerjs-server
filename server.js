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

app.use("/peerjs", peerServer);

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

        // Remove user from queue first (if they were already waiting)
        removeUserFromQueue(peerId);

        if (waitingUsers.length > 0) {
            // FIFO: Match the longest waiting user first
            let matchedUserIndex = waitingUsers.findIndex(user => user.peerId !== peerId);
            
            if (matchedUserIndex !== -1) {
                const matchedUser = waitingUsers.splice(matchedUserIndex, 1)[0];
                console.log(`🔗 Pairing ${peerId} with ${matchedUser.peerId}`);

                io.to(socket.id).emit("match_found", matchedUser.peerId);
                io.to(matchedUser.socketId).emit("match_found", peerId);
            } else {
                waitingUsers.push({ peerId, socketId: socket.id, timestamp: Date.now() });
                console.log(`🕒 ${peerId} added to waiting list`);
            }
        } else {
            waitingUsers.push({ peerId, socketId: socket.id, timestamp: Date.now() });
            console.log(`🕒 ${peerId} added to waiting list`);
        }
        updateQueueCount(); // Log updated queue count
    });

    // ✅ Handle "end_chat" event
    socket.on("end_chat", (peerId) => {
        console.log(`🚫 ${peerId} ended chat. Removing from waiting queue.`);
        removeUserFromQueue(peerId);
        updateQueueCount(); // Log updated queue count
    });

    socket.on("disconnect", () => {
        console.log(`❌ A user disconnected: ${socket.id}`);
        connectedPeers.delete(socket.id);
        updatePeerCount(); // Logs and updates peer count

        // Remove user from waiting list
        removeUserFromQueueBySocket(socket.id);
        updateQueueCount(); // Log updated queue count
    });
});

// ✅ Function to remove a user from waiting queue
function removeUserFromQueue(peerId) {
    const index = waitingUsers.findIndex(user => user.peerId === peerId);
    if (index !== -1) {
        console.log(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
        waitingUsers.splice(index, 1);
    }
}

// ✅ Function to remove a user from waiting queue using socket ID
function removeUserFromQueueBySocket(socketId) {
    const index = waitingUsers.findIndex(user => user.socketId === socketId);
    if (index !== -1) {
        console.log(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
        waitingUsers.splice(index, 1);
    }
}

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
