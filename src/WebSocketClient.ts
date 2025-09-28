import { Effect, Stream, Queue, Scope, Fiber, Option, Data } from "effect"

// Errors
export class WebSocketError extends Data.TaggedError("WebSocketError")<{
  readonly reason: string
}> {}

export class WebSocketConnectionError extends Data.TaggedError("WebSocketConnectionError")<{
  readonly url: string
  readonly reason: string
}> {}

export class WebSocketSendError extends Data.TaggedError("WebSocketSendError")<{
  readonly reason: string
}> {}

// WebSocket Message types
export type WebSocketMessage = string | ArrayBuffer | Blob

// WebSocket Event types
export interface WebSocketEvent {
  readonly _tag: "open" | "close" | "error" | "message"
  readonly data?: WebSocketMessage
  readonly code?: number
  readonly reason?: string
}

// WebSocket Client interface
export interface WebSocketClient {
  readonly send: (message: WebSocketMessage) => Effect.Effect<void, WebSocketSendError>
  readonly messages: Stream.Stream<WebSocketMessage, WebSocketError>
  readonly events: Stream.Stream<WebSocketEvent, WebSocketError>
  readonly close: (code?: number, reason?: string) => Effect.Effect<void, WebSocketError>
  readonly readyState: Effect.Effect<number, never>
}

// WebSocket Client implementation
export class WebSocketClientImpl implements WebSocketClient {
  constructor(
    private readonly ws: WebSocket,
    private readonly messageQueue: Queue.Queue<WebSocketMessage>,
    private readonly eventQueue: Queue.Queue<WebSocketEvent>,
    private readonly scope: Scope.Scope
  ) {}

  send(message: WebSocketMessage): Effect.Effect<void, WebSocketSendError> {
    return Effect.try({
      try: () => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(message as any)
        } else {
          throw new Error("WebSocket is not open")
        }
      },
      catch: (error) => new WebSocketSendError({ reason: (error as Error).message })
    })
  }

  get messages(): Stream.Stream<WebSocketMessage, WebSocketError> {
    return Stream.fromQueue(this.messageQueue)
  }

  get events(): Stream.Stream<WebSocketEvent, WebSocketError> {
    return Stream.fromQueue(this.eventQueue)
  }

  close(code?: number, reason?: string): Effect.Effect<void, WebSocketError> {
    return Effect.try({
      try: () => {
        this.ws.close(code, reason)
      },
      catch: (error) => new WebSocketError({ reason: (error as Error).message })
    })
  }

  get readyState(): Effect.Effect<number, never> {
    return Effect.succeed(this.ws.readyState)
  }
}

// Create a WebSocket client
export const makeWebSocketClient = (
  url: string,
  protocols?: string | string[]
): Effect.Effect<WebSocketClient, WebSocketConnectionError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope

    const messageQueue = yield* Queue.unbounded<WebSocketMessage>()
    const eventQueue = yield* Queue.unbounded<WebSocketEvent>()

    const ws = yield* Effect.try({
      try: () => new WebSocket(url, protocols),
      catch: (error) => new WebSocketConnectionError({
        url,
        reason: `Invalid WebSocket URL: ${(error as Error).message}`
      })
    })

    const client = new WebSocketClientImpl(ws, messageQueue, eventQueue, scope)

    // Set up event listeners
    ws.onopen = () => {
      Queue.unsafeOffer(eventQueue, { _tag: "open" })
    }

    ws.onclose = (event) => {
      Queue.unsafeOffer(eventQueue, {
        _tag: "close",
        code: event.code,
        reason: event.reason
      })
    }

    ws.onerror = (event) => {
      Queue.unsafeOffer(eventQueue, { _tag: "error" })
    }

    ws.onmessage = (event) => {
      Queue.unsafeOffer(messageQueue, event.data)
      Queue.unsafeOffer(eventQueue, {
        _tag: "message",
        data: event.data
      })
    }

    // Wait for connection to open
    yield* Effect.async<void, WebSocketConnectionError>((resume) => {
      if (ws.readyState === WebSocket.OPEN) {
        resume(Effect.succeed(undefined))
      } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        resume(Effect.fail(new WebSocketConnectionError({
          url,
          reason: "Connection closed before opening"
        })))
      } else {
        const onOpen = () => {
          ws.removeEventListener("open", onOpen)
          ws.removeEventListener("error", onError)
          resume(Effect.succeed(undefined))
        }
        const onError = (event: Event) => {
          ws.removeEventListener("open", onOpen)
          ws.removeEventListener("error", onError)
          resume(Effect.fail(new WebSocketConnectionError({
            url,
            reason: "Failed to connect to WebSocket"
          })))
        }
        ws.addEventListener("open", onOpen)
        ws.addEventListener("error", onError)
      }
    })

    // Clean up on scope close
    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }))

    return client
  })

// Helper to create and use a WebSocket client
export const withWebSocketClient = <A, E>(
  url: string,
  protocols: string | string[] | undefined,
  f: (client: WebSocketClient) => Effect.Effect<A, E, Scope.Scope>
): Effect.Effect<A, E | WebSocketConnectionError, Scope.Scope> =>
  Effect.scoped(
    Effect.gen(function* () {
      const client = yield* makeWebSocketClient(url, protocols)
      return yield* f(client)
    })
  )

// Static API following Effect patterns
export const WebSocketClient = {
  make: makeWebSocketClient,
  withWebSocketClient
}