import { Effect, Stream, Queue, Scope, Data } from "effect"
import { WebSocketServer as WSServer, WebSocket as WS } from "ws"

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

// Connection implementation
export class WebSocketConnectionImpl implements WebSocketConnection {
  constructor(
    public readonly id: string,
    private readonly ws: WS
  ) {}

  send(message: string | ArrayBuffer | Buffer): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        if (this.ws.readyState === WS.OPEN) {
          this.ws.send(message)
        } else {
          throw new Error("WebSocket is not open")
        }
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    })
  }

  close(code?: number, reason?: string): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        this.ws.close(code, reason)
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    })
  }

  get readyState(): Effect.Effect<number, never> {
    return Effect.succeed(this.ws.readyState)
  }
}

// Server implementation
export class WebSocketServerImpl implements WebSocketServer {
  constructor(
    private readonly wss: WSServer,
    private readonly connectionQueue: Queue.Queue<WebSocketConnection>,
    private readonly messageQueue: Queue.Queue<ConnectionMessage>
  ) {}

  get connections(): Stream.Stream<WebSocketConnection, WebSocketServerError> {
    return Stream.fromQueue(this.connectionQueue)
  }

  get messages(): Stream.Stream<ConnectionMessage, WebSocketServerError> {
    return Stream.fromQueue(this.messageQueue)
  }

  close(): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        this.wss.close()
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    })
  }
}

// Create a WebSocket server
export const makeWebSocketServer = (
  options: { port?: number; host?: string; path?: string } = {}
): Effect.Effect<WebSocketServer, WebSocketServerError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope

    const connectionQueue = yield* Queue.unbounded<WebSocketConnection>()
    const messageQueue = yield* Queue.unbounded<ConnectionMessage>()

    const wss = new WSServer(options)

    const server = new WebSocketServerImpl(wss, connectionQueue, messageQueue)

    // Handle new connections
    wss.on('connection', (ws: WS) => {
      const id = Math.random().toString(36).substring(7)

      const connection = new WebSocketConnectionImpl(id, ws)

      Queue.unsafeOffer(connectionQueue, connection)

      // Handle messages
      ws.on('message', (data: Buffer) => {
        Queue.unsafeOffer(messageQueue, { connectionId: id, data })
      })

      // Handle close
      ws.on('close', () => {
        // Clean up
      })

      // Handle errors
      ws.on('error', (error: Error) => {
        // Handle error
      })
    })

    // Clean up on scope close
    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      wss.close()
    }))

    return server
  })

// Helper to create and use a WebSocket server
export const withWebSocketServer = <A, E>(
  options: { port?: number; host?: string; path?: string },
  f: (server: WebSocketServer) => Effect.Effect<A, E, Scope.Scope>
): Effect.Effect<A, E | WebSocketServerError, Scope.Scope> =>
  Effect.scoped(
    Effect.gen(function* () {
      const server = yield* makeWebSocketServer(options)
      return yield* f(server)
    })
  )

// Static API following Effect patterns
export const WebSocketServer = {
  make: makeWebSocketServer,
  withWebSocketServer
}