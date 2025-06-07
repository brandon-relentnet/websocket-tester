const WebSocket = require('ws');

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });
const clients = new Set();

console.log('WebSocket server started on port 8080');

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Client connected. Total clients:', clients.size);

    // Send welcome message to the newly connected client
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to WebSocket server',
        timestamp: Date.now()
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);

            // Handle different message types
            switch (data.type) {
                case 'connection':
                    console.log('Client connected at:', new Date(data.timestamp));
                    break;

                case 'user_message':
                    console.log('User message:', data.message);
                    // Echo the message back to the sender
                    ws.send(JSON.stringify({
                        type: 'echo',
                        original_message: data.message,
                        timestamp: Date.now(),
                        message: `Server received: "${data.message}"`
                    }));
                    break;

                case 'test_request':
                    console.log('Test request received');
                    // Send test data back
                    ws.send(JSON.stringify({
                        type: 'new_data',
                        data: {
                            random_number: Math.floor(Math.random() * 1000),
                            server_time: new Date().toISOString(),
                            message: 'This is test data from the server'
                        },
                        timestamp: Date.now()
                    }));
                    break;

                default:
                    console.log('Unknown message type:', data.type);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type',
                        timestamp: Date.now()
                    }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid JSON format',
                timestamp: Date.now()
            }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client disconnected. Total clients:', clients.size);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Function to broadcast to all connected clients
function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Example: Send periodic updates to all clients
setInterval(() => {
    if (clients.size > 0) {
        broadcast({
            type: 'periodic_update',
            data: {
                server_time: new Date().toISOString(),
                connected_clients: clients.size,
                uptime: process.uptime()
            },
            timestamp: Date.now()
        });
    }
}, 30000); // Every 30 seconds

// Function to trigger updates (call this from your injest.js)
function notifyClients(newData) {
    broadcast({
        type: 'new_data',
        data: newData,
        timestamp: Date.now()
    });
}

// Export the function so it can be used by other modules
module.exports = { notifyClients };

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down WebSocket server...');
    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
});