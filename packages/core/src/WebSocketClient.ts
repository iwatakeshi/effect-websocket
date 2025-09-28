import { Effect, Stream, Queue, Scope, Data } from "effect"

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

/**
 * Supported WebSocket message types.
 * Can be a string, binary ArrayBuffer, or Blob.
 */
export type WebSocketMessage = string | ArrayBuffer | Blob

/**
 * Configuration options for automatic reconnection behavior.
 */
export interface ReconnectionOptions {
  /** Whether automatic reconnection is enabled */
  readonly enabled: boolean
  /** Initial delay before first reconnection attempt (milliseconds) */
  readonly initialDelay: number
  /** Maximum delay between reconnection attempts (milliseconds) */
  readonly maxDelay: number
  /** Maximum number of reconnection attempts (0 = unlimited) */
  readonly maxAttempts: number
  /** Multiplier for exponential backoff */
  readonly backoffMultiplier: number
  /** Whether to add random jitter to delay */
  readonly jitter: boolean
}

/**
 * Events emitted by the WebSocket client during its lifecycle.
 */
export interface WebSocketEvent {
  /** The type of event */
  readonly _tag: "open" | "close" | "error" | "message" | "reconnecting" | "reconnect_failed"
  /** Message data (for message events) */
  readonly data?: WebSocketMessage
  /** Close code (for close events) */
  readonly code?: number
  /** Close reason (for close events) */
  readonly reason?: string
  /** Reconnection attempt number (for reconnection events) */
  readonly attempt?: number
}

/**
 * WebSocket client interface for Effect-TS.
 * Provides methods for connecting to WebSocket servers, sending/receiving messages,
 * and handling connection lifecycle with automatic reconnection support.
 *
 * @example
 * ```typescript
 * import { WebSocketClient } from "effect-websocket"
 * import { Effect, Stream } from "effect"
 *
 * const program = WebSocketClient.withClient("ws://localhost:8080", (client) =>
 *   Effect.gen(function* () {
 *     // Send a message
 *     yield* client.send("Hello!")
 *
 *     // Listen for messages
 *     yield* Stream.runForEach(client.messages, (message) => {
 *       console.log("Received:", message)
 *       return Effect.succeed(undefined)
 *     })
 *
 *     // Listen for connection events
 *     yield* Stream.runForEach(client.events, (event) => {
 *       console.log("Event:", event._tag)
 *       return Effect.succeed(undefined)
 *     })
 *   })
 * )
 * ```
 */
export interface WebSocketClient {
  /**
   * Sends a message to the WebSocket server.
   * @param message - The message to send
   * @returns An Effect that succeeds when sent or fails with WebSocketSendError
   */
  readonly send: (message: WebSocketMessage) => Effect.Effect<void, WebSocketSendError>

  /**
   * Stream of messages received from the server.
   */
  readonly messages: Stream.Stream<WebSocketMessage, WebSocketError>

  /**
   * Stream of connection lifecycle events.
   */
  readonly events: Stream.Stream<WebSocketEvent, WebSocketError>

  /**
   * Closes the WebSocket connection.
   * @param code - Optional close code
   * @param reason - Optional close reason
   * @returns An Effect that succeeds when closed or fails with WebSocketError
   */
  readonly close: (code?: number, reason?: string) => Effect.Effect<void, WebSocketError>

  /**
   * Gets the current WebSocket ready state.
   * @returns 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
   */
  readonly readyState: Effect.Effect<number, never>

  /**
   * Checks if the client is currently attempting to reconnect.
   */
  readonly isReconnecting: Effect.Effect<boolean, never>

  /**
   * Gets the number of reconnection attempts made.
   */
  readonly reconnectAttempts: Effect.Effect<number, never>
}

// WebSocket Client implementation
export class WebSocketClientImpl implements WebSocketClient {
  public reconnectAttemptsCount = 0
  public isCurrentlyReconnecting = false
  public manualClose = false
  public reconnectTimeoutId?: NodeJS.Timeout

  constructor(
    public ws: WebSocket,
    private readonly messageQueue: Queue.Queue<WebSocketMessage>,
    private readonly eventQueue: Queue.Queue<WebSocketEvent>,
    private readonly scope: Scope.Scope,
    private readonly url: string,
    private readonly protocols?: string | string[],
    private readonly reconnectionOptions: ReconnectionOptions = {
      enabled: false,
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10,
      backoffMultiplier: 2,
      jitter: true
    }
  ) {}

  send(message: WebSocketMessage): Effect.Effect<void, WebSocketSendError> {
    return Effect.try({
      try: () => {
        if (this.ws.readyState === WebSocket.OPEN) {
          if (message instanceof Blob) {
            message.arrayBuffer().then(buffer => this.ws.send(buffer))
          } else {
            this.ws.send(message)
          }
        } else {
          throw new Error("WebSocket is not connected")
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
    this.manualClose = true
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = undefined
    }
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

  get isReconnecting(): Effect.Effect<boolean, never> {
    return Effect.succeed(this.isCurrentlyReconnecting)
  }

  get reconnectAttempts(): Effect.Effect<number, never> {
    return Effect.succeed(this.reconnectAttemptsCount)
  }

  public setupEventListeners(): void {
    this.ws.onopen = () => {
      this.isCurrentlyReconnecting = false
      this.reconnectAttemptsCount = 0
      Queue.unsafeOffer(this.eventQueue, { _tag: "open" })
    }

    this.ws.onclose = (event) => {
      Queue.unsafeOffer(this.eventQueue, {
        _tag: "close",
        code: event.code,
        reason: event.reason
      })

      // Attempt reconnection if enabled and not manually closed
      if (!this.manualClose && this.reconnectionOptions.enabled) {
        this.attemptReconnection()
      }
    }

    this.ws.onerror = (event) => {
      Queue.unsafeOffer(this.eventQueue, { _tag: "error" })
    }

    this.ws.onmessage = (event) => {
      Queue.unsafeOffer(this.messageQueue, event.data)
      Queue.unsafeOffer(this.eventQueue, { _tag: "message", data: event.data })
    }
  }

  private attemptReconnection(): void {
    if (this.isCurrentlyReconnecting || this.manualClose) return

    const maxAttempts = this.reconnectionOptions.maxAttempts
    if (maxAttempts > 0 && this.reconnectAttemptsCount >= maxAttempts) {
      Queue.unsafeOffer(this.eventQueue, {
        _tag: "reconnect_failed",
        attempt: this.reconnectAttemptsCount
      })
      return
    }

    this.isCurrentlyReconnecting = true
    this.reconnectAttemptsCount++

    const delay = this.calculateReconnectionDelay()
    this.reconnectTimeoutId = setTimeout(() => {
      this.performReconnection()
    }, delay)

    Queue.unsafeOffer(this.eventQueue, {
      _tag: "reconnecting",
      attempt: this.reconnectAttemptsCount
    })
  }

  private calculateReconnectionDelay(): number {
    const { initialDelay, maxDelay, backoffMultiplier, jitter } = this.reconnectionOptions
    const attempt = this.reconnectAttemptsCount - 1

    let delay = initialDelay * Math.pow(backoffMultiplier, attempt)
    delay = Math.min(delay, maxDelay)

    if (jitter) {
      // Add random jitter (±25% of delay)
      const jitterAmount = delay * 0.25
      delay += (Math.random() - 0.5) * 2 * jitterAmount
    }

    return Math.max(0, delay)
  }

  private performReconnection(): void {
    try {
      // Create new WebSocket connection
      this.ws = new WebSocket(this.url, this.protocols)
      this.setupEventListeners()

      // Wait for connection or timeout
      const timeout = setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          this.ws.close()
        }
      }, 10000) // 10 second timeout

      this.ws.onopen = () => {
        clearTimeout(timeout)
        this.isCurrentlyReconnecting = false
        this.reconnectAttemptsCount = 0
        Queue.unsafeOffer(this.eventQueue, { _tag: "open" })
      }

      this.ws.onclose = (event) => {
        clearTimeout(timeout)
        Queue.unsafeOffer(this.eventQueue, {
          _tag: "close",
          code: event.code,
          reason: event.reason
        })

        // Continue reconnection attempts if still enabled
        if (!this.manualClose && this.reconnectionOptions.enabled) {
          this.attemptReconnection()
        }
      }

      this.ws.onerror = () => {
        clearTimeout(timeout)
        // Error will be handled by onclose
      }

      this.ws.onmessage = (event) => {
        Queue.unsafeOffer(this.messageQueue, event.data)
        Queue.unsafeOffer(this.eventQueue, { _tag: "message", data: event.data })
      }

    } catch (error) {
      this.isCurrentlyReconnecting = false
      // If reconnection fails completely, try again
      if (!this.manualClose && this.reconnectionOptions.enabled) {
        this.attemptReconnection()
      }
    }
  }
}

// Create a WebSocket client
export const makeWebSocketClient = (
  url: string,
  protocols?: string | string[],
  reconnectionOptions?: Partial<ReconnectionOptions>
): Effect.Effect<WebSocketClient, WebSocketConnectionError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope

    const messageQueue = yield* Queue.unbounded<WebSocketMessage>()
    const eventQueue = yield* Queue.unbounded<WebSocketEvent>()

    // Merge with default reconnection options
    const defaultReconnectionOptions: ReconnectionOptions = {
      enabled: false,
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: 10,
      backoffMultiplier: 2,
      jitter: true
    }
    const finalReconnectionOptions = { ...defaultReconnectionOptions, ...reconnectionOptions }

    const ws = yield* Effect.try({
      try: () => new WebSocket(url, protocols),
      catch: (error) => new WebSocketConnectionError({
        url,
        reason: `Invalid WebSocket URL: ${(error as Error).message}`
      })
    })

    const client = new WebSocketClientImpl(
      ws,
      messageQueue,
      eventQueue,
      scope,
      url,
      protocols,
      finalReconnectionOptions
    )

    // Set up event listeners
    client.setupEventListeners()

    // Wait for connection to open
    yield* Effect.async<void, WebSocketConnectionError>((resume) => {
      if (ws.readyState === WebSocket.OPEN) {
        resume(Effect.succeed(undefined))
        return
      }

      const onOpen = () => {
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('error', onError)
        resume(Effect.succeed(undefined))
      }

      const onError = (event: Event) => {
        ws.removeEventListener('open', onOpen)
        ws.removeEventListener('error', onError)
        resume(Effect.fail(new WebSocketConnectionError({
          url,
          reason: "Failed to establish WebSocket connection"
        })))
      }

      ws.addEventListener('open', onOpen)
      ws.addEventListener('error', onError)

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.removeEventListener('open', onOpen)
          ws.removeEventListener('error', onError)
          resume(Effect.fail(new WebSocketConnectionError({
            url,
            reason: "WebSocket connection timeout"
          })))
        }
      }, 10000)
    })

    // Clean up on scope close
    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      client.manualClose = true
      if (client.reconnectTimeoutId) {
        clearTimeout(client.reconnectTimeoutId)
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }))

    return client
  })

// Helper to create and use a WebSocket client
export function withWebSocketClient<A, E>(
  url: string,
  f: (client: WebSocketClient) => Effect.Effect<A, E, Scope.Scope>,
  reconnectionOptions?: Partial<ReconnectionOptions>
): Effect.Effect<A, E | WebSocketConnectionError, Scope.Scope>

export function withWebSocketClient<A, E>(
  url: string,
  protocols: string | string[] | undefined,
  f: (client: WebSocketClient) => Effect.Effect<A, E, Scope.Scope>,
  reconnectionOptions?: Partial<ReconnectionOptions>
): Effect.Effect<A, E | WebSocketConnectionError, Scope.Scope>

export function withWebSocketClient<A, E>(
  url: string,
  protocolsOrCallback: string | string[] | undefined | ((client: WebSocketClient) => Effect.Effect<A, E, Scope.Scope>),
  fOrReconnectionOptions?: ((client: WebSocketClient) => Effect.Effect<A, E, Scope.Scope>) | Partial<ReconnectionOptions>,
  reconnectionOptions?: Partial<ReconnectionOptions>
): Effect.Effect<A, E | WebSocketConnectionError, Scope.Scope> {
  // Handle overloaded signatures
  if (typeof protocolsOrCallback === 'function') {
    // Called as: withWebSocketClient(url, f, reconnectionOptions?)
    const f = protocolsOrCallback
    const options = fOrReconnectionOptions as Partial<ReconnectionOptions> | undefined
    return Effect.scoped(
      Effect.gen(function* () {
        const client = yield* makeWebSocketClient(url, undefined, options)
        return yield* f(client)
      })
    )
  } else {
    // Called as: withWebSocketClient(url, protocols, f, reconnectionOptions?)
    const protocols = protocolsOrCallback
    const f = fOrReconnectionOptions as (client: WebSocketClient) => Effect.Effect<A, E, Scope.Scope>
    return Effect.scoped(
      Effect.gen(function* () {
        const client = yield* makeWebSocketClient(url, protocols, reconnectionOptions)
        return yield* f(client)
      })
    )
  }
}

// Static API following Effect patterns
export const WebSocketClient = {
  make: makeWebSocketClient,
  withClient: withWebSocketClient
}