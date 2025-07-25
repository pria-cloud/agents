import { Server as WebSocketServer, WebSocket } from 'ws';
export interface WebSocketClient {
    id: string;
    ws: WebSocket;
    connectedAt: string;
    lastPing: string;
    subscriptions: Set<string>;
}
export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
    clientId?: string;
}
export declare class WebSocketService {
    private clients;
    private pingInterval;
    private readonly wss;
    constructor(wss: WebSocketServer);
    private initialize;
    private handleClientMessage;
    private sendToClient;
    broadcast(type: string, data: any, channel?: string): number;
    sendToClients(clientIds: string[], type: string, data: any): number;
    broadcastToChannel(channel: string, type: string, data: any): number;
    private startPingInterval;
    getStats(): {
        totalConnections: number;
        connections: {
            id: string;
            connectedAt: string;
            lastPing: string;
            subscriptions: string[];
            connectionDuration: number;
        }[];
        isHealthy: boolean;
    };
    getChannels(): {
        [k: string]: number;
    };
    shutdown(): void;
    isHealthy(): boolean;
}
//# sourceMappingURL=websocket-service.d.ts.map