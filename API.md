# API Reference

This document provides a comprehensive reference for the `effect-websocket` library APIs.

## Table of Contents

- [WebSocketClient](#websocketclient)
- [WebSocketServer](#websocketserver)
- [Platform-Specific Implementations](#platform-specific-implementations)
- [Error Types](#error-types)
- [Types and Interfaces](#types-and-interfaces)

## WebSocketClient

The WebSocket client provides methods for connecting to WebSocket servers with automatic reconnection support.

### `WebSocketClient.make(url, protocols?, reconnectionOptions?)`

Creates a new WebSocket client instance that you manage manually.

**Parameters:**
- `url` (string): WebSocket server URL (e.g., `"ws://localhost:8080"`)
- `protocols` (string[]?, optional): Subprotocols to negotiate with the server
- `reconnectionOptions` (Partial<ReconnectionOptions>?, optional): Auto-reconnection settings

**Returns:** `Effect<WebSocketClient, WebSocketConnectionError, Scope>`

**Example:**
```typescript
import { WebSocketClient } from "effect-websocket"
import { Effect } from "effect"

const program = Effect.scoped(
  Effect.gen(function* () {
    const client = yield* WebSocketClient.make("ws://localhost:8080")

    // Use the client...
    yield* client.send("Hello!")

    // Clean up
    yield* client.close()
  })
)
```

### `WebSocketClient.withClient(url, callback, protocols?, reconnectionOptions?)`

Creates a scoped WebSocket client and executes a callback function with it. The connection is automatically cleaned up when the scope ends.

**Parameters:**
- `url` (string): WebSocket server URL
- `callback` (function): Function that receives the WebSocketClient instance
- `protocols` (string[]?, optional): Subprotocols to negotiate
- `reconnectionOptions` (Partial<ReconnectionOptions>?, optional): Auto-reconnection settings

**Returns:** `Effect<A, E | WebSocketConnectionError, Scope>` (where A and E are the callback's return types)

**Example:**
```typescript
import { WebSocketClient } from "effect-websocket"
import { Effect, Stream } from "effect"

const program = WebSocketClient.withClient("ws://localhost:8080", (client) =>
  Effect.gen(function* () {
    // Send a message
    yield* client.send("Hello Server!")

    // Listen for responses
    yield* Stream.runForEach(client.messages, (message) => {
      console.log("Received:", message)
      return Effect.succeed(undefined)
    })

    // Listen for connection events
    yield* Stream.runForEach(client.events, (event) => {
      console.log("Event:", event._tag)
      return Effect.succeed(undefined)
    })
  })
)
```

### Client Methods

#### `client.send(message)`

Sends a message to the WebSocket server.

**Parameters:**
- `message` (WebSocketMessage): String, ArrayBuffer, or Blob to send

**Returns:** `Effect<void, WebSocketSendError>`

#### `client.messages`

Stream of messages received from the server.

**Type:** `Stream<WebSocketMessage, WebSocketError>`

#### `client.events`

Stream of connection lifecycle events.

**Type:** `Stream<WebSocketEvent, WebSocketError>`

#### `client.close(code?, reason?)`

Closes the WebSocket connection.

**Parameters:**
- `code` (number?, optional): Close code (default: 1000)
- `reason` (string?, optional): Close reason

**Returns:** `Effect<void, WebSocketError>`

#### `client.readyState`

Gets the current WebSocket ready state.

**Returns:** `Effect<number, never>` (0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED)

#### `client.isReconnecting`

Checks if the client is currently attempting to reconnect.

**Returns:** `Effect<boolean, never>`

#### `client.reconnectAttempts`

Gets the number of reconnection attempts made.

**Returns:** `Effect<number, never>`

## WebSocketServer

The WebSocket server provides streams for handling connections and messages.

### `makeWebSocketServer(options)`

Creates a new WebSocket server instance.

**Parameters:**
- `options` (object):
  - `port` (number?, optional): Port to listen on
  - `hostname` (string?, optional): Hostname to bind to
  - `path` (string?, optional): URL path for WebSocket endpoint (Node.js only)

**Returns:** `Effect<WebSocketServer, WebSocketServerError, Scope>`

### `withWebSocketServer(options, callback)`

Creates a scoped WebSocket server and executes a callback function with it.

**Parameters:**
- `options` (object): Server options (port, hostname, path)
- `callback` (function): Function that receives the WebSocketServer instance

**Returns:** `Effect<A, E | WebSocketServerError, Scope>`

**Example:**
```typescript
import { withWebSocketServer } from "effect-websocket-node" // or effect-websocket-bun
import { Effect, Stream } from "effect"

const program = Effect.scoped(
  withWebSocketServer({ port: 8080 }, (server) =>
    Effect.gen(function* () {
      console.log("Server started on port 8080")

      // Handle new connections
      yield* Stream.runForEach(server.connections, (connection) => {
        console.log(`New connection: ${connection.id}`)
        return Effect.succeed(undefined)
      })

      // Handle messages from clients
      yield* Stream.runForEach(server.messages, (message) => {
        console.log(`Message from ${message.connectionId}:`, message.data)
        return Effect.succeed(undefined)
      })
    })
  )
)
```

### Server Properties

#### `server.connections`

Stream of new WebSocket connections from clients.

**Type:** `Stream<WebSocketConnection, WebSocketServerError>`

#### `server.messages`

Stream of messages received from connected clients.

**Type:** `Stream<ConnectionMessage, WebSocketServerError>`

#### `server.close()`

Closes the WebSocket server and terminates all connections.

**Returns:** `Effect<void, WebSocketServerError>`

### Connection Methods

#### `connection.send(message)`

Sends a message to the connected client.

**Parameters:**
- `message` (string | ArrayBuffer | Buffer): Message to send

**Returns:** `Effect<void, WebSocketServerError>`

#### `connection.close(code?, reason?)`

Closes the connection to this client.

**Parameters:**
- `code` (number?, optional): Close code
- `reason` (string?, optional): Close reason

**Returns:** `Effect<void, WebSocketServerError>`

#### `connection.readyState`

Gets the connection's ready state.

**Returns:** `Effect<number, never>`

## Platform-Specific Implementations

### Node.js (`effect-websocket-node`)

```typescript
import { withWebSocketServer } from "effect-websocket-node"
// Uses the 'ws' library for high-performance WebSocket servers
```

### Bun (`effect-websocket-bun`)

```typescript
import { withWebSocketServer } from "effect-websocket-bun"
// Uses Bun's native WebSocket API for maximum performance
```

## Error Types

### WebSocketError
General WebSocket operation errors.

### WebSocketConnectionError
Errors that occur during connection establishment.

### WebSocketSendError
Errors that occur when sending messages.

### WebSocketServerError
Server-specific errors.

## Types and Interfaces

### WebSocketMessage
```typescript
type WebSocketMessage = string | ArrayBuffer | Blob
```

### ReconnectionOptions
```typescript
interface ReconnectionOptions {
  enabled: boolean
  initialDelay: number    // milliseconds
  maxDelay: number        // milliseconds
  maxAttempts: number     // 0 = unlimited
  backoffMultiplier: number
  jitter: boolean
}
```

### WebSocketEvent
```typescript
interface WebSocketEvent {
  _tag: "open" | "close" | "error" | "message" | "reconnecting" | "reconnect_failed"
  data?: WebSocketMessage
  code?: number
  reason?: string
  attempt?: number
}
```

### WebSocketConnection
```typescript
interface WebSocketConnection {
  id: string
  send: (message: string | ArrayBuffer | Buffer) => Effect<void, WebSocketServerError>
  close: (code?: number, reason?: string) => Effect<void, WebSocketServerError>
  readyState: Effect<number, never>
}
```

### ConnectionMessage
```typescript
interface ConnectionMessage {
  connectionId: string
  data: string | ArrayBuffer | Buffer
}
```

## Examples

See the `examples/` directory for complete working examples:

- `examples/client.ts` - Basic client usage
- `examples/server.ts` - Basic server usage
- Additional examples for reconnection, binary data, etc.