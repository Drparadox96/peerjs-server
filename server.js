const express = require("express");
const { ExpressPeerServer } = require("peer");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();

// Enable CORS (allows connections from any origin)
const cors = require("cors");
app.use(cors());

// Create an HTTP server for WebSockets
const server = createServer(app);

// Set up Socket.io for WebSocket support
const io = new Server(server, {
    cors: {
        origin: "*",  // Allows all origins
        methods: ["GET", "POST"]
    }
});

// WebSocket connection log
io.on("connection", (socket) => {
    console.log("✅ A user connected:", socket.id);
    socket.on("disconnect", () => {
        console.log("❌ A user disconnected:", socket.id);
    });
});

// Serve a simple welcome message at the root
app.get("/", (req, res) => {
    res.send("✅ PeerJS Server is Running with WebSocket Support!");
});

// Attach PeerJS to Express at "/peerjs"
const peerServer = ExpressPeerServer(server, {
    path: "/",
    allow_discovery: true,
    debug: true
});

app.use("/peerjs", peerServer);

// Use Render's assigned port (fallback to 10000)
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
