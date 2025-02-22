const express = require("express");
const { ExpressPeerServer } = require("peer");

const app = express();

// Enable CORS for all origins
const cors = require("cors");
app.use(cors());

const peerServer = ExpressPeerServer(app, {
    path: "/",
    allow_discovery: true
});

app.use("/peerjs", peerServer);

// Use the Render-assigned port
const PORT = process.env.PORT || 443;
app.listen(PORT, () => {
    console.log(`✅ PeerJS Server is running at https://nkomode-peerjs.onrender.com/peerjs`);
});
