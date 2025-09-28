# Effect WebSocket Bun

[![CI](https://github.com/iwatakeshi/effect-websocket/actions/workflows/ci.yml/badge.svg)](https://github.com/iwatakeshi/effect-websocket/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/effect-websocket-bun.svg)](https://badge.fury.io/js/effect-websocket-bun)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.0.0-000000)](https://bun.sh/)

Bun WebSocket server implementation for Effect-TS using Bun's native WebSocket API, providing fast and efficient WebSocket servers with Effect's functional programming model.

## Overview

This package provides the Bun-specific implementation of the Effect WebSocket server interface. It leverages Bun's native WebSocket API for maximum performance and seamless integration with the Bun runtime.

## Features

- **Native Performance**: Built on Bun's native WebSocket implementation
- **Effect Integration**: Full integration with Effect-TS error handling and effects
- **Streaming**: Message and connection streams using Effect's Stream API
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Bun Optimized**: Tailored for Bun's fast startup and runtime performance

## Installation

```bash
bun add effect-websocket effect-websocket-bun @effect/platform effect
```

## Quick Start

```typescript
import { Effect, Stream } from "effect"
import { WebSocketServer } from "effect-websocket"
import { makeWebSocketServer } from "effect-websocket-bun"

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
  hostname?: string          // Server hostname (default: "localhost")
  tls?: {
    key: string            // TLS private key
    cert: string           // TLS certificate
  }
  maxPayloadLength?: number  // Maximum payload length in bytes
  backpressureLimit?: number // Backpressure limit
  closeOnBackpressureLimit?: boolean  // Close connection on backpressure limit
  perMessageDeflate?: boolean // Enable per-message deflate compression
  webSocket?: {
    message?: (ws: WebSocket, message: string | Buffer) => void
    open?: (ws: WebSocket) => void
    close?: (ws: WebSocket, code: number, reason: string) => void
    error?: (ws: WebSocket, error: Error) => void
  }
}
```

## Advanced Usage

### TLS/SSL Support

```typescript
import { makeWebSocketServer } from "effect-websocket-bun"
import { readFileSync } from "fs"

const program = Effect.scoped(
  makeWebSocketServer({
    port: 443,
    tls: {
      key: readFileSync("path/to/private-key.pem", "utf8"),
      cert: readFileSync("path/to/certificate.pem", "utf8")
    }
  }, (server) => {
    // Secure WebSocket server (wss://)
    return Effect.gen(function* () {
      yield* Stream.runForEach(server.connections, (connection) => {
        return Stream.runForEach(connection.messages, (message) => {
          return connection.send(`Secure: ${message}`)
        })
      })

      yield* Effect.never
    })
  })
)
```

### Backpressure Handling

```typescript
const program = Effect.scoped(
  makeWebSocketServer({
    port: 8080,
    backpressureLimit: 1024 * 1024, // 1MB
    closeOnBackpressureLimit: true
  }, (server) => {
    // Server with backpressure management
    return Effect.gen(function* () {
      yield* Stream.runForEach(server.connections, (connection) => {
        return Stream.runForEach(connection.messages, (message) => {
          // Handle high-throughput scenarios
          return connection.send(`Processed: ${message}`)
        })
      })

      yield* Effect.never
    })
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

## Performance Features

Bun's native WebSocket implementation provides:

- **Fast Startup**: Minimal cold start time
- **High Throughput**: Optimized for high-concurrency scenarios
- **Low Latency**: Native implementation reduces overhead
- **Memory Efficient**: Built-in memory management optimizations

## Error Handling

The package provides comprehensive error handling through Effect-TS:

```typescript
import { WebSocketServerError } from "effect-websocket-bun"

const program = Effect.scoped(
  makeWebSocketServer({ port: 8080 }, (server) => {
    return Effect.catchAll(
      serverLogic(server),
      (error) => {
        if (error._tag === "WebSocketServerError") {
          console.error("Server error:", error.message)
          return Effect.fail(error)
        }
        return Effect.fail(error)
      }
    )
  })
)
```

## Bun-Specific Optimizations

- **Native WebSocket API**: Direct access to Bun's optimized WebSocket implementation
- **Fast Message Processing**: Optimized for Bun's event loop
- **Memory Management**: Automatic memory management for high-throughput scenarios
- **Type Safety**: Full TypeScript integration with Bun's type definitions

## Documentation

- **[Main Documentation](../../README.md)**: Complete project documentation
- **[API Reference](../../API.md)**: Comprehensive API documentation with examples
- **[Bun WebSocket Docs](https://bun.sh/docs/api/websockets)**: Bun's WebSocket API documentation

## Requirements

- **Bun**: >= 1.0.0
- **TypeScript**: >= 5.0.0
- **Effect**: >= 3.17.14

## License

MIT