import { Effect, Stream } from "effect"
import { WebSocketClient } from "../src/index"

// Simple client
const program = Effect.scoped(
  WebSocketClient.withClient(
    "ws://localhost:8080",
    undefined,
    (client) => Effect.gen(function* () {
      console.log("Connected to WebSocket server")

      // Send a message
      yield* client.send("Hello from client!")

      // Listen for messages
      yield* Stream.runForEach(client.messages, (message) => {
        console.log("Received:", message)
        return Effect.succeed(undefined)
      })

      // Listen for events
      yield* Stream.runForEach(client.events, (event) => {
        console.log("Event:", event._tag)
        return Effect.succeed(undefined)
      })

      // Keep running
      yield* Effect.never
    })
  )
)

Effect.runPromise(program).catch(console.error)