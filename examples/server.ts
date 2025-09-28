import { Effect, Stream } from "effect"
import { withWebSocketServer } from "../src/index"

// Simple echo server
const program = Effect.scoped(
  withWebSocketServer(
    { port: 8080 },
    (server) => Effect.gen(function* () {
      console.log("WebSocket server started on port 8080")

      // Handle connections
      yield* Stream.runForEach(server.connections, (connection) => {
        console.log(`New connection: ${connection.id}`)
        return Effect.succeed(undefined)
      })

      // Handle messages
      yield* Stream.runForEach(server.messages, (message) => {
        console.log(`Received message from ${message.connectionId}:`, message.data.toString())
        // In a real application, you would send a response back
        return Effect.succeed(undefined)
      })

      // Keep running
      yield* Effect.never
    })
  )
)

Effect.runPromise(program).catch(console.error)