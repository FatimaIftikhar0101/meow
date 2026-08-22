import type { ServerOptions } from 'socket.io';

/**
 * The socket.io settings both gateways share.
 *
 * These live here rather than in each `@WebSocketGateway()` decorator because a
 * decorator is evaluated at class-definition time, before Nest has built an
 * injector — so `ConfigService` is not reachable from one. Reading
 * `process.env` directly is the standard way out, and keeping it in one file
 * means the two gateways cannot drift apart on it.
 */

/**
 * Which origins a browser may open a socket from.
 *
 * Both gateways previously declared `origin: true`, which reflects whatever
 * origin asked — every origin allowed, on the two endpoints that stream a
 * customer's money movements. The HTTP API has had an allowlist all along;
 * this makes the socket layer agree with it instead of quietly undoing it.
 *
 * A request with no `Origin` header is allowed, and that is not a loophole:
 * the mobile app is a native client and sends none. Origin is a browser
 * concept, so a check on it can only ever constrain browsers — the token in
 * the handshake is what actually authenticates, here as everywhere.
 */
export function socketCorsOptions(): ServerOptions['cors'] {
  const allowed = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:3001'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      // Refused rather than thrown: socket.io turns a thrown error here into a
      // 500, and a rejected origin is a normal outcome, not a server fault.
      callback(null, false);
    },
    credentials: true,
  };
}

/**
 * WebSocket only — no HTTP long-polling fallback.
 *
 * socket.io defaults to opening with long-polling and upgrading. That default
 * carries a requirement most people meet by accident on a single instance and
 * discover the hard way on two: a polling handshake is a sequence of separate
 * HTTP requests that must all reach the *same* process, which means sticky
 * sessions at the load balancer. Railway does not guarantee them. Without
 * stickiness the handshake fails intermittently and looks like a flaky network.
 *
 * The Redis adapter does not fix this. It shares rooms and broadcasts between
 * instances; it does not share the transport state of a half-completed polling
 * handshake. Dropping to websocket-only is the actual fix, and it costs
 * nothing: every client here already pins the same setting.
 *
 * **Any new client must pass `transports: ['websocket']` too.** A client left
 * on the default will attempt polling, be refused, and not silently recover.
 * `mobile/lib/sockets.tsx` is the example to copy.
 */
export const SOCKET_TRANSPORTS: ServerOptions['transports'] = ['websocket'];
