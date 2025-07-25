"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const ws_1 = require("ws");
const uuid_1 = require("uuid");
class WebSocketService {
    constructor(wss) {
        this.clients = new Map();
        this.pingInterval = null;
        this.wss = wss;
        this.initialize();
    }
    initialize() {
        this.wss.on('connection', (ws, req) => {
            const clientId = (0, uuid_1.v4)();
            const client = {
                id: clientId,
                ws,
                connectedAt: new Date().toISOString(),
                lastPing: new Date().toISOString(),
                subscriptions: new Set()
            };
            this.clients.set(clientId, client);
            console.log(`🔌 WebSocket client connected: ${clientId} (${this.clients.size} total)`);
            this.sendToClient(clientId, 'connection_established', {
                clientId,
                serverTime: new Date().toISOString()
            });
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleClientMessage(clientId, message);
                }
                catch (error) {
                    console.error(`Invalid message from client ${clientId}:`, error);
                    this.sendToClient(clientId, 'error', {
                        message: 'Invalid JSON message format'
                    });
                }
            });
            ws.on('close', (code, reason) => {
                this.clients.delete(clientId);
                console.log(`🔌 WebSocket client disconnected: ${clientId} (code: ${code}, reason: ${reason}) (${this.clients.size} remaining)`);
            });
            ws.on('error', (error) => {
                console.error(`WebSocket error for client ${clientId}:`, error);
                this.clients.delete(clientId);
            });
            ws.on('pong', () => {
                const client = this.clients.get(clientId);
                if (client) {
                    client.lastPing = new Date().toISOString();
                }
            });
        });
        this.startPingInterval();
        console.log('✅ WebSocket service initialized');
    }
    handleClientMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        switch (message.type) {
            case 'ping':
                this.sendToClient(clientId, 'pong', {
                    timestamp: new Date().toISOString()
                });
                break;
            case 'subscribe':
                if (message.channel) {
                    client.subscriptions.add(message.channel);
                    this.sendToClient(clientId, 'subscribed', {
                        channel: message.channel
                    });
                    console.log(`📡 Client ${clientId} subscribed to ${message.channel}`);
                }
                break;
            case 'unsubscribe':
                if (message.channel) {
                    client.subscriptions.delete(message.channel);
                    this.sendToClient(clientId, 'unsubscribed', {
                        channel: message.channel
                    });
                    console.log(`📡 Client ${clientId} unsubscribed from ${message.channel}`);
                }
                break;
            case 'get_status':
                this.sendToClient(clientId, 'status', {
                    clientId,
                    connectedClients: this.clients.size,
                    subscriptions: Array.from(client.subscriptions),
                    serverUptime: process.uptime()
                });
                break;
            default:
                console.log(`📨 Received message from ${clientId}:`, message.type);
                break;
        }
    }
    sendToClient(clientId, type, data) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== ws_1.WebSocket.OPEN) {
            return false;
        }
        try {
            const message = {
                type,
                data,
                timestamp: new Date().toISOString(),
                clientId
            };
            client.ws.send(JSON.stringify(message));
            return true;
        }
        catch (error) {
            console.error(`Failed to send message to client ${clientId}:`, error);
            this.clients.delete(clientId);
            return false;
        }
    }
    broadcast(type, data, channel) {
        let sentCount = 0;
        for (const [clientId, client] of this.clients) {
            if (channel && !client.subscriptions.has(channel)) {
                continue;
            }
            if (this.sendToClient(clientId, type, data)) {
                sentCount++;
            }
        }
        console.log(`📡 Broadcasted ${type} to ${sentCount} clients${channel ? ` (channel: ${channel})` : ''}`);
        return sentCount;
    }
    sendToClients(clientIds, type, data) {
        let sentCount = 0;
        for (const clientId of clientIds) {
            if (this.sendToClient(clientId, type, data)) {
                sentCount++;
            }
        }
        console.log(`📤 Sent ${type} to ${sentCount}/${clientIds.length} specified clients`);
        return sentCount;
    }
    broadcastToChannel(channel, type, data) {
        return this.broadcast(type, data, channel);
    }
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            const now = new Date();
            const staleThreshold = 60000;
            for (const [clientId, client] of this.clients) {
                const lastPingTime = new Date(client.lastPing).getTime();
                const timeSinceLastPing = now.getTime() - lastPingTime;
                if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                    if (timeSinceLastPing > staleThreshold) {
                        console.log(`🔌 Closing stale connection: ${clientId}`);
                        client.ws.terminate();
                        this.clients.delete(clientId);
                    }
                    else {
                        try {
                            client.ws.ping();
                        }
                        catch (error) {
                            console.error(`Failed to ping client ${clientId}:`, error);
                            this.clients.delete(clientId);
                        }
                    }
                }
                else {
                    this.clients.delete(clientId);
                }
            }
        }, 30000);
    }
    getStats() {
        const now = new Date();
        const connections = Array.from(this.clients.values()).map(client => ({
            id: client.id,
            connectedAt: client.connectedAt,
            lastPing: client.lastPing,
            subscriptions: Array.from(client.subscriptions),
            connectionDuration: now.getTime() - new Date(client.connectedAt).getTime()
        }));
        return {
            totalConnections: this.clients.size,
            connections,
            isHealthy: this.clients.size >= 0
        };
    }
    getChannels() {
        const channels = new Map();
        for (const client of this.clients.values()) {
            for (const channel of client.subscriptions) {
                channels.set(channel, (channels.get(channel) || 0) + 1);
            }
        }
        return Object.fromEntries(channels);
    }
    shutdown() {
        console.log('🛑 Shutting down WebSocket service...');
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.broadcast('server_shutdown', {
            message: 'Server is shutting down',
            timestamp: new Date().toISOString()
        });
        for (const [clientId, client] of this.clients) {
            try {
                client.ws.close(1001, 'Server shutdown');
            }
            catch (error) {
                console.error(`Error closing connection ${clientId}:`, error);
            }
        }
        this.clients.clear();
        console.log('✅ WebSocket service shut down');
    }
    isHealthy() {
        return this.clients.size >= 0;
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket-service.js.map