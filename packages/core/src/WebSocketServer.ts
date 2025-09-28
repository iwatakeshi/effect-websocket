import { Effect, Stream, Data } from "effect"

// Errors
export class WebSocketServerError extends Data.TaggedError("WebSocketServerError")<{
  readonly reason: string
}> {}

/**
 * Represents a WebSocket connection on the server side.
 * Provides methods for sending messages and managing the connection lifecycle.
 */
export interface WebSocketConnection {
  /** Unique identifier for this connection */
  readonly id: string

  /**
   * Sends a message to the connected client.
   * @param message - The message to send (string, ArrayBuffer, or Buffer)
   * @returns An Effect that succeeds when the message is sent or fails with WebSocketServerError
   */
  readonly send: (message: string | ArrayBuffer | Buffer) => Effect.Effect<void, WebSocketServerError>

  /**
   * Closes the WebSocket connection.
   * @param code - Optional close code (defaults to 1000 - normal closure)
   * @param reason - Optional close reason string
   * @returns An Effect that succeeds when the connection is closed or fails with WebSocketServerError
   */
  readonly close: (code?: number, reason?: string) => Effect.Effect<void, WebSocketServerError>

  /**
   * Gets the current ready state of the WebSocket connection.
   * @returns An Effect that returns the ready state (0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED)
   */
  readonly readyState: Effect.Effect<number, never>
}

/**
 * Represents a message received from a WebSocket client.
 */
export interface ConnectionMessage {
  /** The ID of the connection that sent the message */
  readonly connectionId: string

  /** The message data (string, ArrayBuffer, or Buffer) */
  readonly data: string | ArrayBuffer | Buffer
}

/**
 * WebSocket server interface for Effect-TS.
 * Provides streams for handling connections and messages, with functional error handling.
 *
 * @example
 * ```typescript
 * import { Effect, Stream } from "effect"
 * import { withWebSocketServer } from "effect-websocket-node"
 *
 * const program = Effect.scoped(
 *   withWebSocketServer({ port: 8080 }, (server) =>
 *     Effect.gen(function* () {
 *       // Handle new connections
 *       yield* Stream.runForEach(server.connections, (connection) => {
 *         console.log(`New connection: ${connection.id}`)
 *         return Effect.succeed(undefined)
 *       })
 *
 *       // Handle messages
 *       yield* Stream.runForEach(server.messages, (message) => {
 *         console.log(`Message from ${message.connectionId}:`, message.data)
 *         return Effect.succeed(undefined)
 *       })
 *     })
 *   )
 * )
 * ```
 */
export interface WebSocketServer {
  /**
   * Stream of new WebSocket connections.
   * Each item represents a client that has connected to the server.
   */
  readonly connections: Stream.Stream<WebSocketConnection, WebSocketServerError>

  /**
   * Stream of messages received from connected clients.
   * Each item contains the connection ID and the message data.
   */
  readonly messages: Stream.Stream<ConnectionMessage, WebSocketServerError>

  /**
   * Closes the WebSocket server and terminates all connections.
   * @returns An Effect that succeeds when the server is closed or fails with WebSocketServerError
   */
  readonly close: () => Effect.Effect<void, WebSocketServerError>
}
