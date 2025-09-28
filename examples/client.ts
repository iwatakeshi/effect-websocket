import { Effect, Stream } from "effect"
import { WebSocketClient } from "../src/index"

// Simple client with reconnection
const program = Effect.scoped(
  WebSocketClient.withClient(
    "ws://localhost:8080",
    (client) => Effect.gen(function* () {
      console.log("Connected to WebSocket server")

      // Send a message
      yield* client.send("Hello from client!")

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
            console.log("Error occurred")
            break
        }
        return Effect.succeed(undefined)
      })

      // Keep running
      yield* Effect.never
    }),
    {
      enabled: true,        // Enable automatic reconnection
      initialDelay: 1000,   // Start with 1 second delay
      maxDelay: 10000,      // Maximum delay of 10 seconds
      maxAttempts: 5,       // Try up to 5 times
      backoffMultiplier: 2, // Double the delay each attempt
      jitter: true          // Add randomness to prevent thundering herd
    }
  )
)

Effect.runPromise(program).catch(console.error)