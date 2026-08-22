import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import {
  SOCKET_TRANSPORTS,
  allowRequest,
  socketCorsOptions,
} from './ws-options';

/**
 * Makes the WebSocket layer survive being run more than once.
 *
 * socket.io keeps its rooms in the memory of the process that owns them. That
 * is invisible on one instance and silently wrong on two: a customer connected
 * to instance A gets nothing when their transfer is advanced by the scheduler
 * on instance B. Their tracking screen simply stops updating, with no error
 * anywhere — the emit succeeded, into a room that instance never heard of.
 *
 * This is a live defect, not a future one. It needs no new feature to trigger,
 * only a second replica, and it degrades the customer-facing app rather than
 * the back office.
 *
 * ── Opt-in, deliberately ─────────────────────────────────────────────────────
 *
 * With no `REDIS_URL` the adapter does nothing at all and socket.io behaves
 * exactly as before. That keeps this change from requiring anyone to provision
 * infrastructure today, while making the fix a matter of setting one variable
 * on the day a second instance is wanted.
 *
 * With `REDIS_URL` set, Redis is treated as **required**: a failure to connect
 * stops the process from starting. Falling back to in-memory would be the
 * friendlier behaviour and the wrong one — it would restore precisely the
 * silent, undiagnosable failure this exists to prevent, at the moment somebody
 * had already decided they needed it fixed. During a rolling deploy a refusal
 * to start means the previous instance keeps serving, which is the outcome you
 * want from a broken dependency.
 */
export class ScalableIoAdapter extends IoAdapter {
  private readonly logger = new Logger(ScalableIoAdapter.name);
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private adapterFactory: ReturnType<typeof createAdapter> | null = null;
  private disposed = false;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string | undefined,
  ) {
    super(app);
  }

  /**
   * Called once during bootstrap, before the server listens.
   *
   * `lazyConnect` plus an explicit `connect()` is what turns a connection
   * failure into a rejected promise at startup rather than an ioredis retry
   * loop that never resolves and never complains loudly enough.
   */
  async connect(): Promise<void> {
    if (!this.redisUrl) {
      this.logger.warn(
        'REDIS_URL is not set: WebSocket rooms are in-process only. ' +
          'Safe on a single instance; running more than one will silently ' +
          'drop events for customers connected to a different replica.',
      );
      return;
    }

    // `maxRetriesPerRequest: null` is required by the pub/sub clients: a
    // subscriber connection has no request/response cycle to count retries
    // against, and the default makes ioredis error the connection instead of
    // reconnecting after a blip.
    const options = {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    } as const;

    this.pubClient = new Redis(this.redisUrl, options);
    this.subClient = this.pubClient.duplicate();

    // Once connected, an ioredis error is a transient network event and the
    // client reconnects on its own. Without a listener Node treats it as an
    // unhandled 'error' and terminates the process — losing every HTTP request
    // in flight because a Redis connection blinked.
    for (const [name, client] of [
      ['pub', this.pubClient],
      ['sub', this.subClient],
    ] as const) {
      client.on('error', (err: Error) => {
        this.logger.error(`Redis ${name} client error: ${err.message}`);
      });
    }

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
    this.adapterFactory = createAdapter(this.pubClient, this.subClient);
    this.logger.log('WebSocket rooms are shared through Redis');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: socketCorsOptions(),
      // `cors` covers polling only, and polling is disabled — so without this
      // the allowlist would apply to nothing. See ws-options.ts.
      allowRequest,
      transports: SOCKET_TRANSPORTS,
    }) as Server;

    if (this.adapterFactory) server.adapter(this.adapterFactory);
    return server;
  }

  /**
   * Nest calls this for each gateway server as the application shuts down.
   *
   * Hooked here rather than on a `beforeExit` listener, which does not fire for
   * SIGTERM — the signal a container actually receives when it is asked to
   * stop, and therefore the only one that matters on Railway.
   */
  async close(server: Server): Promise<void> {
    await super.close(server);
    await this.dispose();
  }

  /**
   * Called once per gateway server, so it must tolerate repetition. `quit()`
   * waits for in-flight commands where `disconnect()` would drop them.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await Promise.allSettled([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}
