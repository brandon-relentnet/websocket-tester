import { useState, useEffect, useRef } from 'react';

export default function Home() {
    const [data, setData] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Connecting');
    const [message, setMessage] = useState('');
    const [filteredData, setFilteredData] = useState(null);
    const wsRef = useRef(null);

    // Toggle states for different filters
    const [toggles, setToggles] = useState({
        category1: false,
        category2: false,
        category3: false,
        status_active: false,
        status_pending: false,
        priority_high: false,
        priority_medium: false,
        priority_low: false
    });

    // Available toggle options for the UI
    const toggleOptions = [
        { key: 'category1', label: 'Category 1', group: 'Categories' },
        { key: 'category2', label: 'Category 2', group: 'Categories' },
        { key: 'category3', label: 'Category 3', group: 'Categories' },
        { key: 'status_active', label: 'Active', group: 'Status' },
        { key: 'status_pending', label: 'Pending', group: 'Status' },
        { key: 'priority_high', label: 'High Priority', group: 'Priority' },
        { key: 'priority_medium', label: 'Medium Priority', group: 'Priority' },
        { key: 'priority_low', label: 'Low Priority', group: 'Priority' }
    ];

    // Group toggles by their group property
    const groupedToggles = toggleOptions.reduce((groups, toggle) => {
        const group = toggle.group;
        if (!groups[group]) groups[group] = [];
        groups[group].push(toggle);
        return groups;
    }, {});

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
                    } else if (receivedData.type === "filtered_data") {
                        console.log("Filtered data received:", receivedData);
                        setFilteredData(receivedData);
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

    // Handle toggle changes
    const handleToggleChange = (toggleKey) => {
        const newToggles = {
            ...toggles,
            [toggleKey]: !toggles[toggleKey]
        };
        setToggles(newToggles);

        // Send updated filters to server
        sendFilterRequest(newToggles);
    };

    // Send filter request to server
    const sendFilterRequest = (currentToggles = toggles) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Get array of active toggles
            const activeFilters = Object.entries(currentToggles)
                .filter(([key, value]) => value)
                .map(([key]) => key);

            const filterData = {
                type: 'filter_request',
                filters: activeFilters,
                timestamp: Date.now()
            };

            wsRef.current.send(JSON.stringify(filterData));
            console.log('Sent filter request:', filterData);
        } else {
            console.log('WebSocket is not connected');
        }
    };

    // Clear all filters
    const clearAllFilters = () => {
        const clearedToggles = Object.keys(toggles).reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {});
        setToggles(clearedToggles);
        sendFilterRequest(clearedToggles);
    };

    // Load initial data when connected
    useEffect(() => {
        if (connectionStatus === 'Connected') {
            // Send initial filter request (empty filters = all data)
            sendFilterRequest();
        }
    }, [connectionStatus]);

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
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold mb-4">WebSocket Test with Filtering</h1>

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

                {/* Filter Toggles */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Data Filters</h3>
                        <button
                            onClick={clearAllFilters}
                            disabled={connectionStatus !== 'Connected'}
                            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(groupedToggles).map(([groupName, groupToggles]) => (
                            <div key={groupName} className="bg-white p-3 rounded border">
                                <h4 className="font-medium text-gray-700 mb-2">{groupName}</h4>
                                <div className="space-y-2">
                                    {groupToggles.map((toggle) => (
                                        <label key={toggle.key} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={toggles[toggle.key]}
                                                onChange={() => handleToggleChange(toggle.key)}
                                                disabled={connectionStatus !== 'Connected'}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:cursor-not-allowed"
                                            />
                                            <span className={`text-sm ${connectionStatus !== 'Connected' ? 'text-gray-400' : 'text-gray-700'}`}>
                                                {toggle.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Active Filters Summary */}
                    <div className="mt-3 pt-3 border-t">
                        <span className="text-sm text-gray-600">Active filters: </span>
                        {Object.entries(toggles).filter(([key, value]) => value).length === 0 ? (
                            <span className="text-sm text-gray-400">None (showing all data)</span>
                        ) : (
                            <span className="text-sm text-blue-600">
                                {Object.entries(toggles)
                                    .filter(([key, value]) => value)
                                    .map(([key]) => toggleOptions.find(opt => opt.key === key)?.label)
                                    .join(', ')}
                            </span>
                        )}
                    </div>
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

                {/* Filtered Data Display */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="font-semibold mb-2 text-green-700">Filtered Results:</h3>
                        <pre className="text-sm bg-white p-3 rounded border overflow-auto max-h-64">
                            {filteredData ? JSON.stringify(filteredData, null, 2) : 'No filtered data yet - adjust filters above'}
                        </pre>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="font-semibold mb-2 text-blue-700">Other Messages:</h3>
                        <pre className="text-sm bg-white p-3 rounded border overflow-auto max-h-64">
                            {data ? JSON.stringify(data, null, 2) : 'No other messages received yet'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}