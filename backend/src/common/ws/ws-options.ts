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
 * Which origins may open a socket.
 *
 * ── Read this before trusting it ─────────────────────────────────────────────
 *
 * socket.io's `cors` option only governs its **HTTP long-polling** transport,
 * because that is an ordinary XHR and browsers apply CORS to it. It does not
 * govern WebSocket, and cannot: the WebSocket protocol is exempt from the
 * same-origin policy by design. A browser sends `Origin` on the handshake and
 * then enforces nothing, so any page anywhere can open a socket to any server.
 *
 * Since transports here are pinned to WebSocket only, `cors` alone applies to
 * nothing at all. That was true of the first version of this file, whose
 * comment claimed it "makes the socket layer agree with the HTTP allowlist" —
 * it did not, and a test asserting the allowlist function rejects a bad origin
 * passed happily while the server accepted one. Hence `allowRequest` below,
 * which engine.io calls for *every* handshake including WebSocket, and which is
 * what actually enforces this.
 *
 * ── What actually protects these endpoints ───────────────────────────────────
 *
 * The token in the handshake, and only that. This API authenticates with a
 * bearer token held in SecureStore or the OS keychain, not a cookie — so there
 * is no ambient credential for a hostile page to ride on, and it could not
 * forge an authenticated socket whatever origin it claimed. The origin check is
 * defence in depth, not the defence.
 *
 * A request with **no** `Origin` is allowed, and that is not a loophole: the
 * mobile app is a native client and sends none. Origin is a browser concept, so
 * a check on it can only ever constrain browsers.
 */
function allowedOrigins(): string[] {
  return (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_ORIGIN ||
    'http://localhost:3001'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins().includes(origin);
}

export function socketCorsOptions(): ServerOptions['cors'] {
  return {
    origin(origin, callback) {
      // Refused rather than thrown: socket.io turns a thrown error here into a
      // 500, and a rejected origin is a normal outcome, not a server fault.
      callback(null, isOriginAllowed(origin));
    },
    credentials: true,
  };
}

/**
 * The check that actually runs, on every transport.
 *
 * engine.io calls this for the handshake regardless of transport, which is why
 * it and not `cors` is what makes the allowlist real.
 */
export const allowRequest: ServerOptions['allowRequest'] = (req, callback) => {
  callback(null, isOriginAllowed(req.headers.origin));
};

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
