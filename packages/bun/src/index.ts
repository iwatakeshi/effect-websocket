import { Effect, Layer, Stream, Queue, Scope } from "effect";
import type { WebSocketServer, WebSocketConnection, ConnectionMessage } from "../../core/src";
import { WebSocketServerError } from "../../core/src";

class BunWebSocketConnection implements WebSocketConnection {
  constructor(
    private ws: Bun.ServerWebSocket<any>,
    public readonly id: string
  ) {}

  send(message: string | ArrayBuffer | Buffer): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(message);
        } else {
          throw new Error("WebSocket is not open");
        }
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    });
  }

  close(code?: number, reason?: string): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        this.ws.close(code, reason);
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    });
  }

  get readyState(): Effect.Effect<number, never> {
    return Effect.succeed(this.ws.readyState);
  }
}

class BunWebSocketServer implements WebSocketServer {
  private connectionMap = new Map<Bun.ServerWebSocket<any>, string>();

  constructor(
    private readonly server: any, // Bun Server
    private readonly connectionQueue: Queue.Queue<WebSocketConnection>,
    private readonly messageQueue: Queue.Queue<ConnectionMessage>
  ) {}

  get connections(): Stream.Stream<WebSocketConnection, WebSocketServerError> {
    return Stream.fromQueue(this.connectionQueue);
  }

  get messages(): Stream.Stream<ConnectionMessage, WebSocketServerError> {
    return Stream.fromQueue(this.messageQueue);
  }

  close(): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        this.server.stop();
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    });
  }
}

export const makeWebSocketServer = (
  options: { port?: number; hostname?: string } = {}
): Effect.Effect<WebSocketServer, WebSocketServerError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;
    const connectionQueue = yield* Queue.unbounded<WebSocketConnection>();
    const messageQueue = yield* Queue.unbounded<ConnectionMessage>();
    const connectionMap = new Map<Bun.ServerWebSocket<any>, string>();

    const server = Bun.serve({
      port: options.port || 8080,
      hostname: options.hostname || "localhost",
      websocket: {
        open(ws: Bun.ServerWebSocket<any>) {
          const id = Math.random().toString(36).substring(7);
          connectionMap.set(ws, id);
          const connection = new BunWebSocketConnection(ws, id);

          Queue.unsafeOffer(connectionQueue, connection);
        },
        message(ws: Bun.ServerWebSocket<any>, message: string | Buffer) {
          const id = connectionMap.get(ws);
          if (id) {
            Queue.unsafeOffer(messageQueue, { connectionId: id, data: message });
          }
        },
        close(ws: Bun.ServerWebSocket<any>, code: number, reason: string) {
          connectionMap.delete(ws);
        }
      },
      fetch(req, server) {
        if (server.upgrade(req)) {
          return new Response();
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
    });

    const wsServer = new BunWebSocketServer(server, connectionQueue, messageQueue);

    // Clean up on scope close
    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      server.stop();
    }));

    return wsServer;
  });

export const BunWebSocketServerLive = makeWebSocketServer({ port: 8080 });