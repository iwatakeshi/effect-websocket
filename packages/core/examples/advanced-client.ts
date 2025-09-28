import { Effect, Stream } from "effect"
import { WebSocketClient } from "../src/WebSocketClient"

// Advanced client with reconnection and error handling
// In a real application, you would import from "effect-websocket":
// import { WebSocketClient } from "effect-websocket"

const program = WebSocketClient.withClient(
  "ws://localhost:8080",
  (client) => Effect.gen(function* () {
    console.log("Connected to WebSocket server with reconnection enabled")

    // Send a ping message
    yield* client.send("ping")

    // Listen for messages with error handling
    yield* Stream.runForEach(client.messages, (message) => {
      console.log("📨 Received:", message)

      // Echo the message back
      return client.send(`Echo: ${message}`)
    }).pipe(
      Effect.catchAll((error) => {
        console.error("❌ Message handling error:", (error as any).reason)
        return Effect.succeed(undefined)
      })
    )

    // Monitor connection events
    yield* Stream.runForEach(client.events, (event) => {
      switch (event._tag) {
        case "open":
          console.log("🔗 Connection opened")
          break
        case "close":
          console.log(`🔌 Connection closed: ${event.code} ${event.reason}`)
          break
        case "error":
          console.error("❌ Connection error:", (event as any).reason)
          break
        case "reconnecting":
          console.log(`🔄 Reconnecting (attempt ${(event as any).attempt})`)
          break
        case "reconnect_failed":
          console.error("❌ Reconnection failed")
          break
      }
      return Effect.succeed(undefined)
    })

    // Keep the connection alive
    yield* Effect.never
  }),
  {
    enabled: true,
    initialDelay: 1000,
    maxDelay: 30000,
    maxAttempts: 10,
    backoffMultiplier: 2,
    jitter: true
  }
)

// Run the program
Effect.runPromise(Effect.scoped(program)).catch(console.error)