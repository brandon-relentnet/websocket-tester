import { useState, useEffect, useRef } from 'react';

export default function Home() {
    const [data, setData] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Connecting');
    const [message, setMessage] = useState('');
    const wsRef = useRef(null);

    useEffect(() => {
        let reconnectTimer;
        let isComponentMounted = true;

        const connectWebSocket = (attempt = 1) => {
            if (!isComponentMounted) return;

            try {
                const ws = new WebSocket("ws://localhost:8080");
                wsRef.current = ws;

                ws.onopen = function open() {
                    if (!isComponentMounted) return;
                    console.log("WebSocket connected successfully");
                    setConnectionStatus('Connected');
                    // Send initial connection message
                    ws.send(JSON.stringify({ type: 'connection', timestamp: Date.now() }));
                };

                ws.onclose = function close(event) {
                    if (!isComponentMounted) return;

                    // Only log if it's not an expected initial connection failure
                    if (attempt > 1 || event.code === 1000) {
                        console.log("WebSocket disconnected", event.code);
                    }

                    // Don't show "Disconnected" on initial failed attempts
                    if (attempt === 1 && event.code === 1006) {
                        // This is likely the initial connection failure - stay in "Connecting"
                        console.log("Initial connection attempt failed, retrying...");
                    } else {
                        setConnectionStatus('Disconnected');
                    }

                    // Only try to reconnect if it wasn't a manual close
                    if (event.code !== 1000) {
                        setConnectionStatus('Reconnecting');
                        reconnectTimer = setTimeout(() => {
                            if (isComponentMounted) {
                                connectWebSocket(attempt + 1);
                            }
                        }, 2000); // Reduced to 2 seconds for faster reconnection
                    }
                };

                ws.onmessage = function incoming(event) {
                    if (!isComponentMounted) return;

                    const receivedData = JSON.parse(event.data);
                    console.log('Received:', receivedData);

                    if (receivedData.type === "new_data") {
                        console.log("New data received:", receivedData);
                        setData(receivedData);
                    } else {
                        setData(receivedData);
                    }
                };

                ws.onerror = function error(err) {
                    if (!isComponentMounted) return;

                    // Only log errors after the first attempt to reduce console noise
                    if (attempt > 1) {
                        console.error('WebSocket error on attempt', attempt, err);
                        setConnectionStatus('Connection Error');
                    }
                };

            } catch (error) {
                if (!isComponentMounted) return;

                console.error('Failed to create WebSocket:', error);
                setConnectionStatus('Connection Error');
                reconnectTimer = setTimeout(() => {
                    if (isComponentMounted) {
                        setConnectionStatus('Reconnecting');
                        connectWebSocket(attempt + 1);
                    }
                }, 2000);
            }
        };

        // Add a small delay before initial connection to let the page settle
        const initialDelay = setTimeout(() => {
            if (isComponentMounted) {
                connectWebSocket();
            }
        }, 500);

        // Cleanup on unmount
        return () => {
            isComponentMounted = false;
            clearTimeout(initialDelay);
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
        };
    }, []);

    const sendMessage = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const messageData = {
                type: 'user_message',
                message: message,
                timestamp: Date.now()
            };
            wsRef.current.send(JSON.stringify(messageData));
            console.log('Sent:', messageData);
            setMessage(''); // Clear input after sending
        } else {
            console.log('WebSocket is not connected');
        }
    };

    const sendTestData = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const testData = {
                type: 'test_request',
                timestamp: Date.now()
            };
            wsRef.current.send(JSON.stringify(testData));
            console.log('Sent test request:', testData);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold mb-4">WebSocket Test</h1>

                {/* Connection Status */}
                <div className="mb-4 flex items-center gap-2">
                    <span className="font-semibold">Status: </span>

                    {/* Loading spinner for connecting states */}
                    {(connectionStatus === 'Connecting' || connectionStatus === 'Reconnecting') && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    )}

                    <span className={`px-2 py-1 rounded text-sm ${
                        connectionStatus === 'Connected' ? 'bg-green-100 text-green-800' :
                            connectionStatus === 'Connection Error' ? 'bg-red-100 text-red-800' :
                                connectionStatus === 'Disconnected' ? 'bg-gray-100 text-gray-800' :
                                    'bg-blue-100 text-blue-800' // For Connecting/Reconnecting
                    }`}>
                        {connectionStatus}
                    </span>
                </div>

                {/* Message Input */}
                <div className="mb-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Enter message to send..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!message.trim() || connectionStatus !== 'Connected'}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            Send Message
                        </button>
                    </div>
                </div>

                {/* Test Button */}
                <div className="mb-4">
                    <button
                        onClick={sendTestData}
                        disabled={connectionStatus !== 'Connected'}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Send Test Request
                    </button>
                </div>

                {/* Data Display */}
                <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-semibold mb-2">Received Data:</h3>
                    <pre className="text-sm bg-white p-3 rounded border overflow-auto max-h-64">
                        {data ? JSON.stringify(data, null, 2) : 'No data received yet'}
                    </pre>
                </div>
            </div>
        </div>
    );
}