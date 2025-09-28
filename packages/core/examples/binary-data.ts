import { Effect, Stream } from "effect"
import { WebSocketClient } from "../src/WebSocketClient"

// Binary data handling example
// In a real application, you would import from "effect-websocket":
// import { WebSocketClient } from "effect-websocket"

const program = WebSocketClient.withClient(
  "ws://localhost:8080",
  (client) => Effect.gen(function* () {
    console.log("Connected to WebSocket server for binary data demo")

    // Send binary data (ArrayBuffer)
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setUint32(0, 0x12345678) // Write some data
    view.setUint32(4, 0x9ABCDEF0)

    console.log("📤 Sending binary data:", Array.from(new Uint8Array(buffer)))
    yield* client.send(buffer)

    // Send binary data (Uint8Array)
    const uint8Array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    console.log("📤 Sending Uint8Array:", Array.from(uint8Array))
    yield* client.send(uint8Array.buffer)

    // Listen for binary responses
    yield* Stream.runForEach(client.messages, (message) => {
      if (message instanceof ArrayBuffer) {
        const received = new Uint8Array(message)
        console.log("📨 Received binary data:", Array.from(received))

        // You can process the binary data here
        if (received.length >= 8) {
          const dataView = new DataView(message)
          const value1 = dataView.getUint32(0)
          const value2 = dataView.getUint32(4)
          console.log(`📊 Parsed values: ${value1.toString(16)}, ${value2.toString(16)}`)
        }
      } else {
        console.log("📨 Received text data:", message)
      }
      return Effect.succeed(undefined)
    })

    // Keep connection alive for demo
    yield* Effect.sleep(5000)
  })
)

// Run the program
Effect.runPromise(Effect.scoped(program)).catch(console.error)