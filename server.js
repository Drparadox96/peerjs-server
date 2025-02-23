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
            // Pair with the FIRST user who was waiting (FIFO queue)
            const matchedUser = waitingUsers.shift(); // Oldest user gets matched first
            console.log(`🔗 Pairing ${peerId} with ${matchedUser.peerId}`);

            io.to(socket.id).emit("match_found", matchedUser.peerId);
            io.to(matchedUser.socketId).emit("match_found", peerId);
        } else {
            // No one waiting, add to queue
            waitingUsers.push({ peerId, socketId: socket.id, timestamp: Date.now() });
            console.log(`🕒 ${peerId} added to waiting list`);
        }
    });

    // 🔥 Auto-retry matchmaking every 10 seconds (so users don't get stuck)
    setInterval(() => {
        if (waitingUsers.length > 1) {
            const user1 = waitingUsers.shift(); // Oldest user
            const user2 = waitingUsers.shift(); // Next user
            console.log(`🔄 Auto-matching ${user1.peerId} with ${user2.peerId}`);

            io.to(user1.socketId).emit("match_found", user2.peerId);
            io.to(user2.socketId).emit("match_found", user1.peerId);
        }
    }, 10000); // Retry every 10 seconds

    socket.on("disconnect", () => {
        console.log("❌ A user disconnected:", socket.id);

        // Remove user from waiting list
        const index = waitingUsers.findIndex((user) => user.socketId === socket.id);
        if (index !== -1) {
            console.log(`🗑️ Removing ${waitingUsers[index].peerId} from waiting list`);
            waitingUsers.splice(index, 1);
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
