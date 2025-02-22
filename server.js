const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();

// Enable CORS (allows your website to connect)
const cors = require("cors");
app.use(cors());

// Serve a simple welcome message at root
app.get("/", (req, res) => {
    res.send("✅ PeerJS Server is Running!");
});

// Attach PeerJS to Express at "/peerjs"
const peerServer = ExpressPeerServer(app, {
    path: "/",
    allow_discovery: true
});

app.use("/peerjs", peerServer);

// Use Render-assigned port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://peerjs-server-vbtq.onrender.com/peerjs`);
});
