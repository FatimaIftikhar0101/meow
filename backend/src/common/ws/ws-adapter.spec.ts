import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'net';
import { io, type Socket } from 'socket.io-client';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { TransfersGateway } from '../../transfers/transfers.gateway';
import { ScalableIoAdapter } from './redis-io.adapter';

/**
 * The WebSocket layer, exercised through a real client on a real port.
 *
 * Everything this covers is invisible to the other tests. `createIOServer` is
 * called by Nest, not by any service; the CORS check runs inside socket.io; the
 * transport restriction only exists during a handshake. A mistake in any of
 * them compiles, passes every unit test, and then silently stops delivering
 * transfer updates to customers — which is exactly the failure mode the adapter
 * was written to prevent, so it would be a poor thing to introduce while
 * preventing it.
 *
 * No Redis here. The adapter is deliberately inert without `REDIS_URL`, and
 * that inert path is the one running in production today, so it is the one
 * worth pinning down. What Redis adds — rooms shared between processes —
 * cannot be tested in a single process anyway.
 */

const JWT_SECRET = 'test-secret-at-least-32-characters-long!!';

describe('WebSocket adapter', () => {
  let app: INestApplication;
  let adapter: ScalableIoAdapter;
  let url: string;
  let jwt: JwtService;
  const clients: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        TransfersGateway,
        NotificationsGateway,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'JWT_SECRET' ? JWT_SECRET : undefined,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);

    // No REDIS_URL: the in-memory path, which is what production runs today.
    adapter = new ScalableIoAdapter(app, undefined);
    await adapter.connect();
    app.useWebSocketAdapter(adapter);

    await app.listen(0);
    const server = app.getHttpServer() as { address(): AddressInfo };
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await app.close();
  });

  function connect(
    namespace: string,
    token: string | null,
    origin?: string,
  ): Socket {
    const client = io(`${url}${namespace}`, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: false,
      forceNew: true,
      ...(origin ? { extraHeaders: { Origin: origin } } : {}),
    });
    clients.push(client);
    return client;
  }

  function tokenFor(userId: string): string {
    return jwt.sign({ sub: userId, email: `${userId}@meow.test` });
  }

  it('accepts a websocket-only client carrying a valid token', async () => {
    const client = connect('/transfers', tokenFor('u-1'));
    await new Promise<void>((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
    });
    expect(client.connected).toBe(true);
  });

  it('routes an event to the room for that user and nobody else', async () => {
    const mine = connect('/transfers', tokenFor('u-mine'));
    const theirs = connect('/transfers', tokenFor('u-theirs'));
    await Promise.all(
      [mine, theirs].map(
        (c) => new Promise<void>((resolve) => c.on('connect', () => resolve())),
      ),
    );

    const gateway = app.get(TransfersGateway);
    const received = new Promise<{ transferId: string; status: string }>(
      (resolve) => mine.on('transfer:status', resolve),
    );
    // If this ever reaches the wrong socket it is one customer being shown
    // another customer's money moving.
    let leaked = false;
    theirs.on('transfer:status', () => {
      leaked = true;
    });

    gateway.emitStatus('u-mine', 't-1', 'payout_processing');

    await expect(received).resolves.toEqual({
      transferId: 't-1',
      status: 'payout_processing',
    });
    expect(leaked).toBe(false);
  });

  it('delivers a notification on its own namespace', async () => {
    const client = connect('/notifications', tokenFor('u-notify'));
    await new Promise<void>((resolve) => client.on('connect', () => resolve()));

    const gateway = app.get(NotificationsGateway);
    const received = new Promise<{ id: string }>((resolve) =>
      client.on('notification', resolve),
    );

    gateway.push('u-notify', {
      id: 'n-1',
      type: 'transfer_status',
      title: 'Transfer delivered',
      body: 'Funds delivered to recipient bank',
      createdAt: new Date().toISOString(),
    });

    await expect(received).resolves.toMatchObject({ id: 'n-1' });
  });

  it('refuses a client that tries HTTP long-polling', async () => {
    // The server is websocket-only, because a polling handshake is several
    // HTTP requests that must all land on the same process — sticky sessions,
    // which Railway does not guarantee. This test exists as much to document
    // the consequence as to check it: a client left on socket.io's default
    // transports will be refused here and will NOT quietly fall back.
    const client = io(`${url}/transfers`, {
      transports: ['polling'],
      auth: { token: tokenFor('u-poll') },
      reconnection: false,
      forceNew: true,
    });
    clients.push(client);

    const error = await new Promise<Error>((resolve, reject) => {
      client.on('connect_error', resolve);
      client.on('connect', () => reject(new Error('polling was accepted')));
    });
    expect(error).toBeInstanceOf(Error);
    expect(client.connected).toBe(false);
  });

  describe.each([
    ['no token at all', null],
    ['a token signed with the wrong secret', 'not.a.valid.token'],
  ])('with %s', (_label, token) => {
    it('disconnects rather than leaving an unauthenticated socket open', async () => {
      const client = connect('/transfers', token);
      await new Promise<void>((resolve) => {
        client.on('disconnect', () => resolve());
        client.on('connect_error', () => resolve());
      });
      expect(client.connected).toBe(false);
    });
  });
});

/**
 * Origins, tested with the clients that actually connect.
 *
 * The previous version of this block asserted that a disallowed origin was
 * refused, and it passed. It was also the bug: React Native's WebSocketModule
 * sets an `Origin` header derived from the URL when the caller supplies none,
 * so every phone presented the API's own origin, was refused, and lost live
 * transfer updates entirely — while the tracking screen, which has no polling
 * fallback, sat on "initiated" through a completed payment.
 *
 * What made that invisible is worth naming: the only client in the test suite
 * was Node, which sends no `Origin` at all. It was the one client incapable of
 * revealing the problem, and it was the one used to prove the check was right.
 *
 * So these assert the opposite property now — that a socket carrying an origin
 * nobody listed still connects, because the handshake token is what authorises
 * it. See ws-options.ts for why refusing bought nothing over a door already
 * locked by the token.
 */
describe('WebSocket origins', () => {
  let app: INestApplication;
  let url: string;
  let jwt: JwtService;
  const clients: Socket[] = [];
  const previousOrigins = process.env.CORS_ORIGINS;

  beforeAll(async () => {
    process.env.CORS_ORIGINS = 'https://allowed.example.com';
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        TransfersGateway,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'JWT_SECRET' ? JWT_SECRET : undefined,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwt = moduleRef.get(JwtService);
    const adapter = new ScalableIoAdapter(app, undefined);
    await adapter.connect();
    app.useWebSocketAdapter(adapter);
    await app.listen(0);
    const server = app.getHttpServer() as { address(): AddressInfo };
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await app.close();
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  });

  function attempt(origin?: string): Promise<'connected' | 'refused'> {
    const client = io(`${url}/transfers`, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      auth: { token: jwt.sign({ sub: 'u-1', email: 'u@meow.test' }) },
      ...(origin ? { extraHeaders: { Origin: origin } } : {}),
    });
    clients.push(client);
    return new Promise((resolve) => {
      client.on('connect', () => resolve('connected'));
      client.on('connect_error', () => resolve('refused'));
    });
  }

  it.each([
    ['an origin on the list', 'https://allowed.example.com'],
    // The exact header a React Native phone sends. This is the case that broke.
    ['the API own origin, as React Native sends', 'https://api.example.com'],
    ['an origin nobody listed', 'https://evil.example.com'],
    ['no Origin at all, as a Node client sends', undefined],
  ])('connects with %s', async (_label, origin) => {
    await expect(attempt(origin)).resolves.toBe('connected');
  });

  it('still refuses a socket with no token, whatever origin it claims', async () => {
    // The check that actually protects the namespace. If this ever passes the
    // other way, dropping the origin refusal was the wrong trade.
    const client = io(`${url}/transfers`, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: { Origin: 'https://allowed.example.com' },
    });
    clients.push(client);
    const outcome = await new Promise<string>((resolve) => {
      client.on('disconnect', () => resolve('disconnected'));
      client.on('connect_error', () => resolve('refused'));
    });
    expect(['disconnected', 'refused']).toContain(outcome);
    expect(client.connected).toBe(false);
  });
});
