const express = require("express");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

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

// Logging function
function logEvent(event) {
    const logMessage = `${new Date().toISOString()} - ${event}\n`;
    console.log(logMessage); // Show logs in the Render dashboard
    fs.appendFile("matchmaking.log", logMessage, (err) => {
        if (err) console.error("Error writing log:", err);
    });
}

// Handle new WebSocket connections
io.on("connection", (socket) => {
    logEvent(`✅ User connected: ${socket.id}`);

    socket.on("find_match", (peerId) => {
        logEvent(`🟢 User ${peerId} is searching for a match...`);

        if (waitingUsers.length > 0) {
            // Pair with the first waiting user
            const matchedPeer = waitingUsers.shift();
            logEvent(`🔗 Pairing ${peerId} with ${matchedPeer.peerId}`);

            io.to(socket.id).emit("match_found", matchedPeer.peerId);
            io.to(matchedPeer.socketId).emit("match_found", peerId);
        } else {
            // No one waiting, add to queue
            waitingUsers.push({ peerId, socketId: socket.id });
            logEvent(`🕒 ${peerId} added to waiting list`);
        }
    });

    socket.on("disconnect", () => {
        logEvent(`❌ User disconnected: ${socket.id}`);

        // Remove user from waiting list
        const index = waitingUsers.findIndex((user) => user.socketId === socket.id);
        if (index !== -1) {
            logEvent(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
            waitingUsers.splice(index, 1);
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    logEvent(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
