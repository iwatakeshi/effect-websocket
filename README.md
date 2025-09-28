# Effect WebSocket Library

[![CI](https://github.com/iwatakeshi/effect-websocket/actions/workflows/ci.yml/badge.svg)](https://github.com/iwatakeshi/effect-websocket/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/effect-websocket.svg)](https://badge.fury.io/js/effect-websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.0.0-000000)](https://bun.sh/)

A WebSocket library for Effect-TS that provides both client and server functionality with runtime portability across Node.js, Bun, and browser environments.

## Architecture

This library follows Effect's ecosystem patterns with a mono-repo structure:

- **`effect-websocket`** (core): Runtime-agnostic interfaces and types
- **`effect-websocket-node`**: Node.js implementation using the `ws` package
- **`effect-websocket-bun`**: Bun implementation using native WebSocket APIs

## Features

### WebSocketClient

**Static Methods:**
- `WebSocketClient.make(url, protocols?, reconnectionOptions?)`: Create a WebSocket client
- `WebSocketClient.withClient(url, callback, reconnectionOptions?)`: Create and use a WebSocket client with automatic cleanup (when protocols not needed)
- `WebSocketClient.withClient(url, protocols, callback, reconnectionOptions?)`: Create and use a WebSocket client with automatic cleanup (when protocols needed)

**Instance Methods:**
- `send(message)`: Send a message
- `messages`: Stream of incoming messages
- `events`: Stream of WebSocket events (open, close, error, message, reconnecting, reconnect_failed)
- `close()`: Close the connection
- `readyState`: Current connection state
- `isReconnecting`: Check if currently attempting reconnection
- `reconnectAttempts`: Get number of reconnection attempts made with proper error handling and streaming.

## Installation

```bash
# For Node.js
bun add effect-websocket effect-websocket-node @effect/platform effect

# For Bun
bun add effect-websocket effect-websocket-bun @effect/platform effect
```

## Documentation

- **[API Reference](API.md)**: Comprehensive API documentation with examples
- **Examples**: See the `packages/core/examples/` directory for complete working examples:
  - `client.ts`: Basic client usage
  - `server.ts`: Basic server usage
  - `advanced-client.ts`: Client with reconnection and error handling
  - `binary-data.ts`: Handling binary messages

## Usage

### Client

```typescript
import { Effect, Stream } from "effect"
import { WebSocketClient } from "effect-websocket"

const program = Effect.scoped(
  WebSocketClient.withClient("ws://localhost:8080", (client) =>
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
  )
)

Effect.runPromise(program)
```

### Server

```typescript
import { Effect, Stream } from "effect"
import { WebSocketServer } from "effect-websocket"
// Import platform-specific implementation
import { makeWebSocketServer } from "effect-websocket-node" // or "effect-websocket-bun"

const program = Effect.scoped(
  makeWebSocketServer({ port: 8080 }, (server) =>
    Effect.gen(function* () {
      console.log("WebSocket server started on port 8080")

      // Handle new connections
      yield* Stream.runForEach(server.connections, (connection) => {
        console.log("New connection:", connection.id)

        // Handle messages from this connection
        return Stream.runForEach(connection.messages, (message) => {
          console.log(`Message from ${connection.id}:`, message)

          // Echo the message back
          return connection.send(`Echo: ${message}`)
        })
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

## Development

### Testing

```bash
# Run all tests
bun run test

# Run tests in CI mode (non-watch)
bun run test:packages

# Run specific test file
bun run test packages/core/test/WebSocketClient.test.ts
```

### Building

```bash
# Build all packages
bun run build:packages

# Clean build artifacts
bun run clean
```

### Publishing

Each package can be published independently:

```bash
# Publish core package
cd packages/core && npm publish

# Publish Node.js package
cd packages/node && npm publish

# Publish Bun package
cd packages/bun && npm publish
```

## Examples

See the `packages/core/examples/` directory for complete client and server examples.

### Running Examples

```bash
# Client example (requires a running server)
cd packages/core/examples && bun run client.ts

# Server example
cd packages/core/examples && bun run server.ts
```

## Contributing

This is a mono-repo using workspaces. Make sure to:

1. Run tests before committing: `bun run test:packages`
2. Update examples if you change the API
3. Test on both Node.js and Bun runtimes
4. Follow Effect's coding patterns and error handling

## License

MIT
