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

const waitingMen = [];
const waitingWomen = [];
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

        // Remove user from waiting lists
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
