# Effect WebSocket Library

A WebSocket library for Effect-TS that provides both client and server functionality with proper error handling and streaming.

## Installation

```bash
bun add effect @effect/platform ws
```

## Usage

### Client

```typescript
import { Effect, Stream } from "effect"
import { WebSocketClient } from "effect-websocket"

const program = Effect.scoped(
  WebSocketClient.withClient("ws://localhost:8080", undefined, (client) =>
    Effect.gen(function* () {
      // Send a message
      yield* client.send("Hello!")

      // Listen for messages
      yield* Stream.runForEach(client.messages, (message) => {
        console.log("Received:", message)
        return Effect.succeed(undefined)
      })

      // Listen for events (including reconnection events)
      yield* Stream.runForEach(client.events, (event) => {
        switch (event._tag) {
          case "open":
            console.log("Connected")
            break
          case "close":
            console.log("Disconnected:", event.code, event.reason)
            break
          case "reconnecting":
            console.log(`Reconnecting (attempt ${event.attempt})`)
            break
          case "reconnect_failed":
            console.log("Reconnection failed after", event.attempt, "attempts")
            break
          case "error":
            console.log("Error:", event)
            break
        }
        return Effect.succeed(undefined)
      })

      yield* Effect.never
    })
  , {
    enabled: true,        // Enable automatic reconnection
    initialDelay: 1000,   // Start with 1 second delay
    maxDelay: 30000,      // Maximum delay of 30 seconds
    maxAttempts: 10,      // Try up to 10 times
    backoffMultiplier: 2, // Double the delay each attempt
    jitter: true          // Add randomness to prevent thundering herd
  })
)

Effect.runPromise(program)
```

### Server

```typescript
import { Effect, Stream } from "effect"
import { WebSocketServer } from "effect-websocket"

const program = Effect.scoped(
  WebSocketServer.withServer({ port: 8080 }, (server) =>
    Effect.gen(function* () {
      // Handle new connections
      yield* Stream.runForEach(server.connections, (connection) => {
        console.log(`New connection: ${connection.id}`)
        return Effect.succeed(undefined)
      })

      // Handle messages from all connections
      yield* Stream.runForEach(server.messages, (message) => {
        console.log(`Message from ${message.connectionId}:`, message.data)
        return Effect.succeed(undefined)
      })

      yield* Effect.never
    })
  )
)

Effect.runPromise(program)
```

## API

### WebSocketClient

**Static Methods:**
- `WebSocketClient.make(url, protocols?, reconnectionOptions?)`: Create a WebSocket client
- `WebSocketClient.withClient(url, protocols?, f, reconnectionOptions?)`: Create and use a WebSocket client with automatic cleanup

**Instance Methods:**
- `send(message)`: Send a message
- `messages`: Stream of incoming messages
- `events`: Stream of WebSocket events (open, close, error, message, reconnecting, reconnect_failed)
- `close()`: Close the connection
- `readyState`: Current connection state
- `isReconnecting`: Check if currently attempting reconnection
- `reconnectAttempts`: Get number of reconnection attempts made

**Reconnection Options:**
```typescript
interface ReconnectionOptions {
  enabled: boolean           // Enable/disable automatic reconnection
  initialDelay: number       // Initial delay in milliseconds (default: 1000)
  maxDelay: number          // Maximum delay in milliseconds (default: 30000)
  maxAttempts: number       // Maximum attempts (0 = unlimited, default: 10)
  backoffMultiplier: number // Delay multiplier per attempt (default: 2)
  jitter: boolean           // Add randomness to delay (default: true)
}
```

### WebSocketServer

**Static Methods:**
- `WebSocketServer.make(options)`: Create a WebSocket server
- `WebSocketServer.withServer(options, f)`: Create and use a WebSocket server with automatic cleanup

**Instance Methods:**
- `connections`: Stream of new connections
- `messages`: Stream of messages from all connections (with connectionId)
- `close()`: Close the server

## Testing

```bash
bun run test
```

## Building

```bash
bun run build
```

## Examples

See the `examples/` directory for complete client and server examples.ket

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
