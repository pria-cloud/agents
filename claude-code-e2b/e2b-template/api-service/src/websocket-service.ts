import { Server as WebSocketServer, WebSocket } from 'ws'
import { v4 as uuidv4 } from 'uuid'

export interface WebSocketClient {
  id: string
  ws: WebSocket
  connectedAt: string
  lastPing: string
  subscriptions: Set<string>
}

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
  clientId?: string
}

export class WebSocketService {
  private clients = new Map<string, WebSocketClient>()
  private pingInterval: NodeJS.Timeout | null = null
  private readonly wss: WebSocketServer

  constructor(wss: WebSocketServer) {
    this.wss = wss
    this.initialize()
  }

  private initialize() {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4()
      const client: WebSocketClient = {
        id: clientId,
        ws,
        connectedAt: new Date().toISOString(),
        lastPing: new Date().toISOString(),
        subscriptions: new Set()
      }

      this.clients.set(clientId, client)
      console.log(`🔌 WebSocket client connected: ${clientId} (${this.clients.size} total)`)

      // Send welcome message
      this.sendToClient(clientId, 'connection_established', {
        clientId,
        serverTime: new Date().toISOString()
      })

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleClientMessage(clientId, message)
        } catch (error) {
          console.error(`Invalid message from client ${clientId}:`, error)
          this.sendToClient(clientId, 'error', {
            message: 'Invalid JSON message format'
          })
        }
      })

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        this.clients.delete(clientId)
        console.log(`🔌 WebSocket client disconnected: ${clientId} (code: ${code}, reason: ${reason}) (${this.clients.size} remaining)`)
      })

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error)
        this.clients.delete(clientId)
      })

      // Update last ping time
      ws.on('pong', () => {
        const client = this.clients.get(clientId)
        if (client) {
          client.lastPing = new Date().toISOString()
        }
      })
    })

    // Start ping interval to keep connections alive
    this.startPingInterval()

    console.log('✅ WebSocket service initialized')
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId)
    if (!client) return

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, 'pong', {
          timestamp: new Date().toISOString()
        })
        break

      case 'subscribe':
        if (message.channel) {
          client.subscriptions.add(message.channel)
          this.sendToClient(clientId, 'subscribed', {
            channel: message.channel
          })
          console.log(`📡 Client ${clientId} subscribed to ${message.channel}`)
        }
        break

      case 'unsubscribe':
        if (message.channel) {
          client.subscriptions.delete(message.channel)
          this.sendToClient(clientId, 'unsubscribed', {
            channel: message.channel
          })
          console.log(`📡 Client ${clientId} unsubscribed from ${message.channel}`)
        }
        break

      case 'get_status':
        this.sendToClient(clientId, 'status', {
          clientId,
          connectedClients: this.clients.size,
          subscriptions: Array.from(client.subscriptions),
          serverUptime: process.uptime()
        })
        break

      default:
        console.log(`📨 Received message from ${clientId}:`, message.type)
        // Forward to other handlers if needed
        break
    }
  }

  private sendToClient(clientId: string, type: string, data: any) {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      const message: WebSocketMessage = {
        type,
        data,
        timestamp: new Date().toISOString(),
        clientId
      }

      client.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error)
      this.clients.delete(clientId)
      return false
    }
  }

  // Broadcast message to all connected clients
  broadcast(type: string, data: any, channel?: string) {
    let sentCount = 0

    for (const [clientId, client] of this.clients) {
      // If channel is specified, only send to subscribed clients
      if (channel && !client.subscriptions.has(channel)) {
        continue
      }

      if (this.sendToClient(clientId, type, data)) {
        sentCount++
      }
    }

    console.log(`📡 Broadcasted ${type} to ${sentCount} clients${channel ? ` (channel: ${channel})` : ''}`)
    return sentCount
  }

  // Send message to specific clients
  sendToClients(clientIds: string[], type: string, data: any) {
    let sentCount = 0

    for (const clientId of clientIds) {
      if (this.sendToClient(clientId, type, data)) {
        sentCount++
      }
    }

    console.log(`📤 Sent ${type} to ${sentCount}/${clientIds.length} specified clients`)
    return sentCount
  }

  // Broadcast to clients subscribed to a specific channel
  broadcastToChannel(channel: string, type: string, data: any) {
    return this.broadcast(type, data, channel)
  }

  private startPingInterval() {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      const now = new Date()
      const staleThreshold = 60000 // 60 seconds

      for (const [clientId, client] of this.clients) {
        const lastPingTime = new Date(client.lastPing).getTime()
        const timeSinceLastPing = now.getTime() - lastPingTime

        if (client.ws.readyState === WebSocket.OPEN) {
          if (timeSinceLastPing > staleThreshold) {
            // Connection seems stale, close it
            console.log(`🔌 Closing stale connection: ${clientId}`)
            client.ws.terminate()
            this.clients.delete(clientId)
          } else {
            // Send ping
            try {
              client.ws.ping()
            } catch (error) {
              console.error(`Failed to ping client ${clientId}:`, error)
              this.clients.delete(clientId)
            }
          }
        } else {
          // Connection is not open, remove it
          this.clients.delete(clientId)
        }
      }
    }, 30000)
  }

  // Get connection statistics
  getStats() {
    const now = new Date()
    const connections = Array.from(this.clients.values()).map(client => ({
      id: client.id,
      connectedAt: client.connectedAt,
      lastPing: client.lastPing,
      subscriptions: Array.from(client.subscriptions),
      connectionDuration: now.getTime() - new Date(client.connectedAt).getTime()
    }))

    return {
      totalConnections: this.clients.size,
      connections,
      isHealthy: this.clients.size >= 0 // Always healthy
    }
  }

  // Get list of all channels with subscriber counts
  getChannels() {
    const channels = new Map<string, number>()

    for (const client of this.clients.values()) {
      for (const channel of client.subscriptions) {
        channels.set(channel, (channels.get(channel) || 0) + 1)
      }
    }

    return Object.fromEntries(channels)
  }

  // Close all connections and cleanup
  shutdown() {
    console.log('🛑 Shutting down WebSocket service...')

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    // Send shutdown notification to all clients
    this.broadcast('server_shutdown', {
      message: 'Server is shutting down',
      timestamp: new Date().toISOString()
    })

    // Close all connections
    for (const [clientId, client] of this.clients) {
      try {
        client.ws.close(1001, 'Server shutdown')
      } catch (error) {
        console.error(`Error closing connection ${clientId}:`, error)
      }
    }

    this.clients.clear()
    console.log('✅ WebSocket service shut down')
  }

  isHealthy(): boolean {
    return this.clients.size >= 0 // Always consider healthy if no errors
  }
}