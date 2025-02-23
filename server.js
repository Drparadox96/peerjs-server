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

io.on("connection", (socket) => {
    console.log("✅ A user connected:", socket.id);

    socket.on("find_match", (peerId) => {
        console.log(`🟢 User ${peerId} is searching for a match...`);

        if (waitingUsers.length > 0) {
            // Pair with the first waiting user
            const matchedPeer = waitingUsers.shift();
            console.log(`🔗 Pairing ${peerId} with ${matchedPeer}`);

            io.to(socket.id).emit("match_found", matchedPeer);
            io.to(matchedPeer.socketId).emit("match_found", peerId);
        } else {
            // No one waiting, add to queue
            waitingUsers.push({ peerId, socketId: socket.id });
            console.log(`🕒 ${peerId} added to waiting list`);
        }
    });

    socket.on("disconnect", () => {
        console.log("❌ A user disconnected:", socket.id);
        // Remove user from waiting list
        const index = waitingUsers.findIndex((user) => user.socketId === socket.id);
        if (index !== -1) {
            waitingUsers.splice(index, 1);
            console.log(`🗑️ Removed ${socket.id} from waiting list`);
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
