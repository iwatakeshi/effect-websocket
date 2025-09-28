import { Effect, Stream, Data } from "effect"

// Errors
export class WebSocketServerError extends Data.TaggedError("WebSocketServerError")<{
  readonly reason: string
}> {}

// WebSocket Connection
export interface WebSocketConnection {
  readonly id: string
  readonly send: (message: string | ArrayBuffer | Buffer) => Effect.Effect<void, WebSocketServerError>
  readonly close: (code?: number, reason?: string) => Effect.Effect<void, WebSocketServerError>
  readonly readyState: Effect.Effect<number, never>
}

// Message with connection ID
export interface ConnectionMessage {
  readonly connectionId: string
  readonly data: string | ArrayBuffer | Buffer
}

// WebSocket Server
export interface WebSocketServer {
  readonly connections: Stream.Stream<WebSocketConnection, WebSocketServerError>
  readonly messages: Stream.Stream<ConnectionMessage, WebSocketServerError>
  readonly close: () => Effect.Effect<void, WebSocketServerError>
}
