import { WebSocketServer as WSServer, WebSocket as WS } from "ws";
import { Effect, Stream, Queue, Scope } from "effect";
import type { WebSocketServer, WebSocketConnection, ConnectionMessage } from "../../core/src";
import { WebSocketServerError } from "../../core/src";

class NodeWebSocketConnection implements WebSocketConnection {
  constructor(
    private ws: WS,
    public readonly id: string
  ) {}

  send(message: string | ArrayBuffer | Buffer): Effect.Effect<void, WebSocketServerError> {
    return Effect.try({
      try: () => {
        if (this.ws.readyState === WS.OPEN) {
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

class NodeWebSocketServer implements WebSocketServer {
  constructor(
    private readonly wss: WSServer,
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
        this.wss.close();
      },
      catch: (error) => new WebSocketServerError({ reason: (error as Error).message })
    });
  }
}

export const makeWebSocketServer = (
  options: { port?: number; host?: string; path?: string } = {}
): Effect.Effect<WebSocketServer, WebSocketServerError, Scope.Scope> =>
  Effect.gen(function* () {
    const scope = yield* Effect.scope;
    const connectionQueue = yield* Queue.unbounded<WebSocketConnection>();
    const messageQueue = yield* Queue.unbounded<ConnectionMessage>();

    const wss = new WSServer(options);
    const server = new NodeWebSocketServer(wss, connectionQueue, messageQueue);

    // Handle new connections
    wss.on('connection', (ws: WS) => {
      const id = Math.random().toString(36).substring(7);
      const connection = new NodeWebSocketConnection(ws, id);

      Queue.unsafeOffer(connectionQueue, connection);

      // Handle messages
      ws.on('message', (data: Buffer) => {
        Queue.unsafeOffer(messageQueue, { connectionId: id, data });
      });

      // Handle close
      ws.on('close', () => {
        // Clean up if needed
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        // Handle error if needed
      });
    });

    // Clean up on scope close
    yield* Scope.addFinalizer(scope, Effect.sync(() => {
      wss.close();
    }));

    return server;
  });

export const NodeWebSocketServerLive = makeWebSocketServer({ port: 8080 });

// Helper to create and use a WebSocket server
export const withWebSocketServer = <A, E>(
  options: { port?: number; hostname?: string },
  f: (server: WebSocketServer) => Effect.Effect<A, E, Scope.Scope>
): Effect.Effect<A, E | WebSocketServerError, Scope.Scope> =>
  Effect.scoped(
    Effect.gen(function* () {
      const server = yield* makeWebSocketServer(options)
      return yield* f(server)
    })
  );