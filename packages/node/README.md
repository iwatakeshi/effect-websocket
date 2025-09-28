# Effect WebSocket Node.js

[![npm version](https://badge.fury.io/js/effect-websocket-node.svg)](https://badge.fury.io/js/effect-websocket-node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js WebSocket server implementation for Effect-TS using the `ws` library, providing high-performance WebSocket servers with Effect's functional error handling.

## Overview

This package provides the Node.js-specific implementation of the Effect WebSocket server interface. It uses the popular `ws` library for WebSocket functionality and integrates seamlessly with Effect-TS's functional programming model.

## Features

- **High Performance**: Built on the battle-tested `ws` library
- **Effect Integration**: Full integration with Effect-TS error handling and effects
- **Streaming**: Message and connection streams using Effect's Stream API
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Production Ready**: Used in production environments worldwide

## Installation

```bash
bun add effect-websocket effect-websocket-node @effect/platform effect
```

## Quick Start

```typescript
import { Effect, Stream } from "effect"
import { WebSocketServer } from "effect-websocket"
import { makeWebSocketServer } from "effect-websocket-node"

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

## Server Options

```typescript
interface WebSocketServerOptions {
  port?: number              // Server port (default: 8080)
  host?: string             // Server host (default: "localhost")
  backlog?: number          // Connection backlog
  server?: http.Server      // Custom HTTP server instance
  verifyClient?: (info: {
    origin: string
    secure: boolean
    req: IncomingMessage
  }) => boolean             // Client verification function
  handleProtocols?: (protocols: Set<string>, request: IncomingMessage) => string | false
  path?: string             // WebSocket path (default: "/")
  maxPayload?: number       // Maximum payload size in bytes
  perMessageDeflate?: boolean | object  // Enable per-message deflate compression
  clientTracking?: boolean  // Track clients (default: true)
}
```

## Advanced Usage

### Custom HTTP Server

```typescript
import { createServer } from "http"
import { makeWebSocketServer } from "effect-websocket-node"

const httpServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" })
  res.end("Hello from HTTP server!")
})

const program = Effect.scoped(
  makeWebSocketServer({ server: httpServer }, (wsServer) =>
    Effect.gen(function* () {
      console.log("WebSocket server attached to HTTP server")

      // Handle WebSocket connections on the same server
      yield* Stream.runForEach(wsServer.connections, (connection) => {
        return Stream.runForEach(connection.messages, (message) => {
          return connection.send(`WebSocket: ${message}`)
        })
      })

      yield* Effect.never
    })
  )
)
```

### Client Verification

```typescript
const program = Effect.scoped(
  makeWebSocketServer({
    port: 8080,
    verifyClient: (info) => {
      // Only allow connections from localhost
      return info.origin === "http://localhost:3000"
    }
  }, (server) => {
    // Server implementation...
  })
)
```

## API Reference

### makeWebSocketServer

```typescript
makeWebSocketServer(
  options: WebSocketServerOptions,
  f: (server: WebSocketServer) => Effect<never, never, void>
): Effect<Scope, WebSocketServerError, void>
```

Creates and manages a WebSocket server with automatic cleanup.

**Parameters:**
- `options`: Server configuration options
- `f`: Function that receives the server instance and returns an Effect

**Returns:** An Effect that manages the server lifecycle

## Error Handling

The package provides comprehensive error handling through Effect-TS:

```typescript
import { WebSocketServerError } from "effect-websocket-node"

const program = Effect.scoped(
  makeWebSocketServer({ port: 8080 }, (server) => {
    return Effect.catchAll(
      serverLogic(server),
      (error) => {
        if (error._tag === "WebSocketServerError") {
          console.error("Server error:", error.message)
          return Effect.succeed(undefined)
        }
        return Effect.fail(error)
      }
    )
  })
)
```

## Performance Considerations

- The `ws` library is highly optimized for performance
- Use `perMessageDeflate` for compression when sending large messages
- Consider `maxPayload` limits to prevent memory exhaustion
- Use `clientTracking: false` if you don't need to track individual clients

## Documentation

- **[Main Documentation](../../README.md)**: Complete project documentation
- **[API Reference](../../API.md)**: Comprehensive API documentation with examples
- **[ws Library](https://github.com/websockets/ws)**: Underlying WebSocket library documentation

## License

MIT