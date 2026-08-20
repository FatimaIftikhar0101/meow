/**
 * Database access for the one-off scripts in this directory.
 *
 * These run on a developer's machine with Railway's environment injected
 * (`railway run …`), never inside the container — ts-node is a devDependency
 * and is not installed there. That combination has one sharp edge, and it is
 * shared by every script here, so it lives in one place.
 */
import { PrismaClient } from '@prisma/client';

/**
 * Prefer the public proxy address, since these scripts run outside Railway.
 *
 * Railway's DATABASE_URL is `postgres.railway.internal`, which resolves only
 * inside its private network. Checking for that hostname explicitly earns its
 * few lines: without it the failure is a Prisma connection stack trace naming
 * a host that looks perfectly plausible, and nothing in it suggests the address
 * is simply not meant to be reachable from here.
 */
export function databaseUrl(): string {
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Neither DATABASE_PUBLIC_URL nor DATABASE_URL is set. Run this through ' +
        '`railway run` so the service variables are injected.',
    );
  }
  if (url.includes('.railway.internal')) {
    throw new Error(
      "DATABASE_URL points at Railway's private network " +
        '(postgres.railway.internal), which cannot be reached from this ' +
        'machine. Add DATABASE_PUBLIC_URL = ${{Postgres.DATABASE_PUBLIC_URL}} ' +
        "to the backend service's variables and run again.",
    );
  }
  return url;
}

/**
 * A client pointed at whatever `databaseUrl()` resolved to, held to a single
 * connection.
 *
 * The public proxy does not tolerate a pool the way a direct connection does:
 * several queries issued at once come back as `Can't reach database server`,
 * which reads like the database is down rather than like too many sockets.
 * One connection is plenty for a one-off script and removes the failure mode.
 */
export function scriptPrisma(): PrismaClient {
  const url = new URL(databaseUrl());
  url.searchParams.set('connection_limit', '1');
  return new PrismaClient({ datasourceUrl: url.toString() });
}
