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
import { withWebSocketClient } from "effect-websocket"

const program = Effect.scoped(
  withWebSocketClient("ws://localhost:8080", undefined, (client) =>
    Effect.gen(function* () {
      // Send a message
      yield* client.send("Hello!")

      // Listen for messages
      yield* Stream.runForEach(client.messages, (message) => {
        console.log("Received:", message)
        return Effect.succeed(undefined)
      })

      // Listen for events
      yield* Stream.runForEach(client.events, (event) => {
        console.log("Event:", event._tag)
        return Effect.succeed(undefined)
      })

      yield* Effect.never
    })
  )
)

Effect.runPromise(program)
```

### Server

```typescript
import { Effect, Stream } from "effect"
import { withWebSocketServer } from "effect-websocket"

const program = Effect.scoped(
  withWebSocketServer({ port: 8080 }, (server) =>
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

- `send(message)`: Send a message
- `messages`: Stream of incoming messages
- `events`: Stream of WebSocket events (open, close, error, message)
- `close()`: Close the connection
- `readyState`: Current connection state

### WebSocketServer

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
