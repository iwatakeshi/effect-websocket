# Effect WebSocket Core

[![npm version](https://badge.fury.io/js/effect-websocket.svg)](https://badge.fury.io/js/effect-websocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Runtime-agnostic WebSocket library for Effect-TS with client/server support, automatic reconnection, and cross-platform compatibility (Node.js, Bun, Browser).

## Overview

The core package provides TypeScript interfaces, types, and runtime-agnostic implementations for WebSocket functionality. It defines the contracts that platform-specific implementations must fulfill.

## Features

- **Runtime Agnostic**: Pure TypeScript interfaces and types
- **WebSocket Client**: Full-featured client with automatic reconnection
- **WebSocket Server**: Server interface for handling connections
- **Effect Integration**: Built on Effect-TS for functional error handling
- **Streaming**: Message and event streams using Effect's Stream API
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
bun add effect-websocket effect @effect/platform
```

## Quick Start

### Client Usage

```typescript
import { Effect, Stream } from "effect"
import { WebSocketClient } from "effect-websocket"
// Import platform-specific implementation
import { makeWebSocketClient } from "effect-websocket-node" // or "effect-websocket-bun"

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

      yield* Effect.never
    })
  )
)

Effect.runPromise(program)
```

### Server Usage

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

## API Overview

### WebSocketClient

**Static Methods:**
- `WebSocketClient.make(url, protocols?, reconnectionOptions?)`: Create a WebSocket client
- `WebSocketClient.withClient(url, protocols?, f, reconnectionOptions?)`: Create and use a WebSocket client with automatic cleanup

**Instance Methods:**
- `send(message)`: Send a message (string or binary)
- `messages`: Stream of incoming messages
- `events`: Stream of WebSocket events (open, close, error, message, reconnecting, reconnect_failed)
- `close()`: Close the connection
- `readyState`: Current connection state
- `isReconnecting`: Check if currently attempting reconnection
- `reconnectAttempts`: Get number of reconnection attempts made

### WebSocketServer

**Static Methods:**
- `WebSocketServer.make(options)`: Create a WebSocket server
- `WebSocketServer.withServer(options, f)`: Create and use a WebSocket server with automatic cleanup

**Instance Methods:**
- `connections`: Stream of new connections
- `messages`: Stream of messages from all connections (with connectionId)
- `close()`: Close the server

## Platform Implementations

Choose the appropriate platform implementation:

- **Node.js**: `effect-websocket-node` - Uses the `ws` library
- **Bun**: `effect-websocket-bun` - Uses Bun's native WebSocket API
- **Browser**: Use client-only functionality with browser WebSocket API

## Examples

See the `examples/` directory for complete working examples:

- `client.ts`: Basic client usage
- `server.ts`: Basic server usage
- `advanced-client.ts`: Client with reconnection and error handling
- `binary-data.ts`: Handling binary messages

## Documentation

- **[Main Documentation](../../README.md)**: Complete project documentation
- **[API Reference](../../API.md)**: Comprehensive API documentation with examples

## License

MIT