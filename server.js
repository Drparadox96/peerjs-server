// server.js (Updated PeerJS Server)
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

io.on("connection", (socket) => {
    console.log("✅ A user connected:", socket.id);
    socket.on("disconnect", () => {
        console.log("❌ A user disconnected:", socket.id);
    });
});

app.get("/", (req, res) => {
    res.send("✅ PeerJS Server is Running with WebSocket Support!");
});

const peerServer = ExpressPeerServer(server, {
    path: "/",
    allow_discovery: true,
    debug: true
});

peerServer.on("connection", (client) => {
    console.log(`🟢 New Peer connected: ${client.getId()}`);
});

peerServer.on("disconnect", (client) => {
    console.log(`🔴 Peer disconnected: ${client.getId()}`);
});

app.use("/peerjs", peerServer);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});

// Keep the server alive on Render (prevent sleeping)
setInterval(() => {
    require("https").get("https://peerjs-server-vbtq.onrender.com/");
}, 5 * 60 * 1000); // Ping every 5 minutes
