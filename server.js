const { PeerServer } = require('peer');

const PORT = process.env.PORT || 10000;

const peerServer = PeerServer({
    port: PORT,
    path: '/peerjs',
    allow_discovery: true
});

peerServer.on('connection', (client) => {
    console.log(`Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`Client disconnected: ${client.getId()}`);
});

console.log(`PeerJS server running on port ${PORT}...`);
