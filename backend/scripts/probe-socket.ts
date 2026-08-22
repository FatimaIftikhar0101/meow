/** Temporary: does a real authenticated socket connect and stay connected? */
import { io } from 'socket.io-client';
import * as jwt from 'jsonwebtoken';

const URL = 'https://backend-production-4cbe.up.railway.app';
const userId = process.argv[2];
const secret = process.env.JWT_SECRET;
if (!secret)
  throw new Error('JWT_SECRET not injected — run through `railway run`');

const token: string = jwt.sign(
  { sub: userId, email: 'probe@meow.test' },
  secret,
  { expiresIn: '1h' },
);

/**
 * React Native's WebSocketModule sets an `Origin` header derived from the URL
 * when the caller supplies none. These are the origins a phone could plausibly
 * present. If any of them is refused, the customer app cannot receive live
 * transfer updates.
 */
const ORIGINS: Array<string | undefined> = [
  undefined,
  'https://backend-production-4cbe.up.railway.app',
  'http://backend-production-4cbe.up.railway.app',
  'file://',
  'null',
];

function attempt(origin: string | undefined): Promise<string> {
  return new Promise((resolve) => {
    const socket = io(`${URL}/transfers`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 12000,
      ...(origin ? { extraHeaders: { Origin: origin } } : {}),
    });
    const done = (verdict: string) => {
      socket.close();
      resolve(`${(origin ?? '(no Origin header)').padEnd(50)} ${verdict}`);
    };
    socket.on('connect', () => done('CONNECTED'));
    socket.on('connect_error', (e: Error) => done(`REFUSED (${e.message})`));
    setTimeout(() => done('TIMEOUT'), 13000);
  });
}

void (async () => {
  for (const o of ORIGINS) console.log(await attempt(o));
  process.exit(0);
})();
