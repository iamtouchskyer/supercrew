import type { EventBus } from '../events/event-bus.js'
import type { Feature } from '../types.js'

// WebSocket message types
type WSMessage =
  | { type: 'connected'; clientCount: number }
  | { type: 'feature:created'; feature: Feature }
  | { type: 'feature:updated'; feature: Feature }
  | { type: 'feature:deleted'; featureId: string }
  | { type: 'conflict:detected'; featureId: string; local: Feature; remote: Feature }

interface WebSocketClient {
  ws: WebSocket
  send: (data: WSMessage) => void
}

export class WebSocketServer {
  private clients: Set<WebSocketClient> = new Set()

  constructor(private eventBus: EventBus) {
    this.setupEventListeners()
  }

  setupEventListeners() {
    this.eventBus.on('feature:created', (feature: Feature) => {
      this.broadcast({ type: 'feature:created', feature })
    })

    this.eventBus.on('feature:updated', (feature: Feature) => {
      this.broadcast({ type: 'feature:updated', feature })
    })

    this.eventBus.on('feature:deleted', (featureId: string) => {
      this.broadcast({ type: 'feature:deleted', featureId })
    })

    this.eventBus.on('conflict:detected', (featureId: string, local: Feature, remote: Feature) => {
      this.broadcast({ type: 'conflict:detected', featureId, local, remote })
    })
  }

  handleConnection(ws: WebSocket) {
    const client: WebSocketClient = {
      ws,
      send: (data: WSMessage) => ws.send(JSON.stringify(data)),
    }
    this.clients.add(client)

    ws.addEventListener('close', () => {
      this.clients.delete(client)
    })

    // Send initial connection confirmation
    client.send({ type: 'connected', clientCount: this.clients.size })
  }

  broadcast(data: WSMessage) {
    for (const client of this.clients) {
      try {
        client.send(data)
      } catch (e) {
        this.clients.delete(client)
      }
    }
  }

  get clientCount() {
    return this.clients.size
  }
}
