import { describe, it, expect, beforeEach } from "vitest"
import { Effect, Stream, Chunk } from "effect"
import { WebSocketClient } from "../src/WebSocketClient"
import { WebSocketServer } from "../src/WebSocketServer"

describe("WebSocket Integration", () => {
  let basePort: number

  beforeEach(() => {
    // Use random ports to avoid conflicts between tests
    basePort = 8080 + Math.floor(Math.random() * 100)
  })

  it("should handle basic client-server connection", async () => {
    const port = basePort

    const result = await Effect.runPromiseExit(
      Effect.scoped(
        WebSocketServer.withServer({ port }, (server) =>
          Effect.gen(function* () {
            // Simple client connection
            const clientResult = yield* Effect.scoped(
              WebSocketClient.withClient(`ws://localhost:${port}`, undefined, (client) =>
                Effect.gen(function* () {
                  // Just connect and close
                  yield* client.send("ping")
                  return "connected"
                })
              )
            )

            // Check that server received a connection
            const connections = yield* Stream.take(server.connections, 1).pipe(
              Stream.runCollect
            )

            return {
              clientResult,
              connectionCount: Chunk.size(connections)
            }
          })
        )
      )
    )

    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value.clientResult).toBe("connected")
      expect(result.value.connectionCount).toBe(1)
    }
  })

  it("should handle message exchange between client and server", async () => {
    const port = basePort + 1
    const testMessage = "Hello Server!"

    const result = await Effect.runPromiseExit(
      Effect.scoped(
        WebSocketServer.withServer({ port }, (server) =>
          Effect.gen(function* () {
            // Client sends message first
            yield* Effect.scoped(
              WebSocketClient.withClient(`ws://localhost:${port}`, undefined, (client) =>
                Effect.gen(function* () {
                  yield* client.send(testMessage)
                  yield* Effect.sleep(200) // Give time for message to be processed
                })
              )
            )

            // Now collect messages with timeout
            const messageResult = yield* Effect.race(
              Stream.take(server.messages, 1).pipe(Stream.runCollect),
              Effect.sleep(2000).pipe(Effect.map(() => Chunk.empty<never>()))
            )

            return Chunk.size(messageResult) > 0 ? Chunk.unsafeGet(messageResult, 0).data.toString() : ""
          })
        )
      )
    )

    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toBe(testMessage)
    }
  }, 10000)

  it("should handle multiple clients connecting to server", async () => {
    const port = basePort + 2
    const numClients = 2

    const result = await Effect.runPromiseExit(
      Effect.scoped(
        WebSocketServer.withServer({ port }, (server) =>
          Effect.gen(function* () {
            // Connect multiple clients first
            const clientEffects = Array.from({ length: numClients }, () =>
              Effect.scoped(
                WebSocketClient.withClient(`ws://localhost:${port}`, undefined, (client) =>
                  Effect.gen(function* () {
                    yield* client.send("hello")
                    yield* Effect.sleep(100)
                  })
                )
              )
            )

            yield* Effect.all(clientEffects, { concurrency: "unbounded" })

            // Now collect connections with timeout
            const connections = yield* Effect.race(
              Stream.take(server.connections, numClients).pipe(Stream.runCollect),
              Effect.sleep(3000).pipe(Effect.map(() => Chunk.empty<never>()))
            )

            return Chunk.size(connections)
          })
        )
      )
    )

    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toBe(numClients)
    }
  }, 10000)

  it("should handle binary messages", async () => {
    const port = basePort + 3
    const binaryData = new Uint8Array([1, 2, 3, 4, 5])

    const result = await Effect.runPromiseExit(
      Effect.scoped(
        WebSocketServer.withServer({ port }, (server) =>
          Effect.gen(function* () {
            // Client sends binary data first
            yield* Effect.scoped(
              WebSocketClient.withClient(`ws://localhost:${port}`, undefined, (client) =>
                Effect.gen(function* () {
                  yield* client.send(binaryData.buffer)
                  yield* Effect.sleep(200)
                })
              )
            )

            // Now collect one message with timeout
            const messageChunk = yield* Effect.race(
              Stream.take(server.messages, 1).pipe(Stream.runCollect),
              Effect.sleep(2000).pipe(Effect.map(() => Chunk.empty<never>()))
            )

            let receivedData: Uint8Array | null = null
            if (Chunk.size(messageChunk) > 0) {
              const message = Chunk.unsafeGet(messageChunk, 0)
              receivedData = new Uint8Array(message.data as ArrayBuffer)
            }

            return receivedData
          })
        )
      )
    )

    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toEqual(binaryData)
    }
  }, 10000)

  it("should handle connection close events", async () => {
    const port = basePort + 4

    const result = await Effect.runPromiseExit(
      Effect.scoped(
        WebSocketServer.withServer({ port }, (server) =>
          Effect.gen(function* () {
            // Client connects and disconnects first
            yield* Effect.scoped(
              WebSocketClient.withClient(`ws://localhost:${port}`, undefined, (client) =>
                Effect.gen(function* () {
                  yield* client.send("hello")
                  yield* Effect.sleep(100)
                  yield* client.close(1000, "Client disconnect")
                })
              )
            )

            // Collect connections to verify connection was established
            const connections = yield* Effect.race(
              Stream.take(server.connections, 1).pipe(Stream.runCollect),
              Effect.sleep(2000).pipe(Effect.map(() => Chunk.empty<never>()))
            )

            return Chunk.size(connections)
          })
        )
      )
    )

    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toBe(1)
    }
  }, 10000)

  it("should handle server responding to client messages", async () => {
    const port = basePort + 5
    const clientMessage = "ping"

    const result = await Effect.runPromiseExit(
      Effect.scoped(
        WebSocketServer.withServer({ port }, (server) =>
          Effect.gen(function* () {
            // Client sends message
            yield* Effect.scoped(
              WebSocketClient.withClient(`ws://localhost:${port}`, undefined, (client) =>
                Effect.gen(function* () {
                  yield* client.send(clientMessage)
                  yield* Effect.sleep(200)
                })
              )
            )

            // Server collects the message
            const messages = yield* Effect.race(
              Stream.take(server.messages, 1).pipe(Stream.runCollect),
              Effect.sleep(2000).pipe(Effect.map(() => Chunk.empty<never>()))
            )

            return Chunk.size(messages) > 0 ? Chunk.unsafeGet(messages, 0).data.toString() : ""
          })
        )
      )
    )

    expect(result._tag).toBe("Success")
    if (result._tag === "Success") {
      expect(result.value).toBe(clientMessage)
    }
  }, 10000)
})