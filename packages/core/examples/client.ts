import { Effect, Stream } from "effect"
import { WebSocketClient } from "../src/index"

// Simple client with reconnection
// In a real application, you would import from "effect-websocket":
// import { WebSocketClient } from "effect-websocket"

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
            console.log("Error:", event)
            break
        }
        return Effect.succeed(undefined)
      })

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
)

Effect.runPromise(program).catch(console.error)