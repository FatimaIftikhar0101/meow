# Deployment configuration reference

Runtime knobs that must be re-tuned as we move from MVP → production.

**Purpose of this file:** the values below are deliberately sized for a single
small container running an MVP. Every one of them has a "before production
launch" action. Work through the checklist at the bottom before go-live.

Last reviewed: 2026-07-26 (MVP / Railway Hobby).

---

## 1. `connection_limit` — Prisma client-side connection pool

**Applied now:** `?connection_limit=10&pool_timeout=20` on `DATABASE_URL`.

### Why it is pinned

Prisma's default pool size is `(physical CPU count × 2) + 1`. Inside a
container that count is read from the **host**, not from the cgroup CPU quota,
so on a shared host it can resolve to something absurd like 33 or 65 while the
container is actually limited to a fraction of a vCPU. Pinning it removes the
guess.

### How to choose the value

The binding constraint is Postgres, not the app:

```
total_app_connections = connection_limit × number_of_instances
```

This must stay comfortably below the server's `max_connections`, leaving
headroom for migrations, `psql`, backups, and monitoring. A common rule is to
budget the app no more than ~60–70% of `max_connections`.

| Environment | Instances | `connection_limit` | Total | Notes |
| --- | --- | --- | --- | --- |
| Local dev | 1 | 10 | 10 | Postgres default `max_connections` is 100. |
| MVP (Railway Hobby, 1 replica) | 1 | 10 | 10 | Current setting. Plenty of headroom. |
| Production (N replicas) | N | **recalculate** | ≤ ~60% of `max_connections` | See below. |

**Production:** do *not* simply raise this. Once there is more than one
instance, put **PgBouncer in transaction mode** (or the managed pooler the
provider offers) in front of Postgres, point `DATABASE_URL` at the pooler, and
then set a *low* per-instance `connection_limit`. With a pooler the app no
longer needs many real backends.

> ⚠ **PgBouncer requires a Prisma flag.** In transaction-pooling mode you must
> add `&pgbouncer=true` to the URL, otherwise prepared statements collide
> across pooled sessions and you get intermittent
> `prepared statement "s0" already exists` errors under load. These fail
> *randomly and only under concurrency*, so they will not show up in testing.

`pool_timeout=20` is how long (seconds) a query waits for a free pooled
connection before throwing. If `P2024` pool-timeout errors start appearing in
logs, that is the signal the pool is undersized for the workload — raise the
pool or add the pooler; do not just raise the timeout.

### Where to change it

`backend/.env` locally; the `DATABASE_URL` service variable on the host in
deployed environments.

---

## 2. `UV_THREADPOOL_SIZE` — libuv worker threads

**Recommended value: `8`. Not yet applied — see below.**

### Why it matters

Password hashing uses `bcrypt` at cost factor 10
(`src/auth/auth.service.ts`), roughly 60–80 ms of CPU per hash. The native
bcrypt binding runs on the **libuv threadpool**, which defaults to **4**
threads. That is good — it keeps hashing off the event loop — but it also
means at most 4 password hashes can be in flight at once. A burst of logins
queues, and because the same pool also serves `fs` and `dns` work, that queue
delays unrelated requests too.

Raising it to 8 gives headroom for login spikes. Do not raise it far beyond the
available CPU: these are real OS threads competing for the same cores, so an
oversized pool adds context-switching without adding throughput.

### ⚠ It cannot be set in `.env`

libuv reads this variable from the **real process environment when the
threadpool is first initialised**, which happens before `@nestjs/config` has
parsed `.env`. Putting `UV_THREADPOOL_SIZE` in `.env` is a **silent no-op** —
the app starts, nothing errors, and the pool is still 4.

It has to come from outside the Node process:

- **Railway / any PaaS:** add `UV_THREADPOOL_SIZE=8` as a **service variable**
  (not in `.env`). This is the one that matters for production.
- **Local shell (PowerShell):** `$env:UV_THREADPOOL_SIZE=8; npm run start:dev`
- **Local shell (bash):** `UV_THREADPOOL_SIZE=8 npm run start:dev`
- **Committed to npm scripts:** would need the `cross-env` dev-dependency to
  work on both Windows and Linux. Not added — flagged as an option.

### How to verify it actually took effect

```js
// node -e with the app's env loaded
console.log(process.env.UV_THREADPOOL_SIZE);
```

That only proves the variable is visible. To prove the *pool* grew, run a load
test that fires concurrent logins and check whether p95 latency scales past
4 concurrent hashes.

---

## Pre-production checklist

Configuration:

- [ ] Recalculate `connection_limit` against the production
      `max_connections` and replica count.
- [ ] Put PgBouncer (or the managed pooler) in front of Postgres, and add
      `&pgbouncer=true` to `DATABASE_URL`.
- [ ] Set `UV_THREADPOOL_SIZE=8` as a real platform variable and confirm it
      applied.
- [ ] Rotate `JWT_SECRET` — the dev value must never reach production.
- [ ] `FRONTEND_ORIGIN` → real domain, and `CORS_ORIGINS` → every browser
      origin that calls the API (web app, admin, preview deployments). The
      native app needs no entry: CORS is a browser mechanism and a native
      client sends no `Origin`.
- [ ] `GOOGLE_CALLBACK_URL` → real domain, and registered in Google Cloud
      Console.
- [ ] Move off Gmail SMTP (rate-limited) to Resend / Postmark / SES.
- [ ] Review `TRANSFER_DAILY_LIMIT` and the hard-coded
      `FUND_LIMIT_PER_DAY` in `src/wallet/wallet.service.ts` against the
      limits the compliance program actually commits to.
- [ ] `THROTTLE_*` — note the throttler currently uses **in-memory** storage,
      so limits are per-instance and reset on restart. Needs a Redis store
      before running more than one replica.

Platform:

- [ ] Confirm the region satisfies Canadian data-residency expectations
      (see the licensing notes) — Railway and Render have no CA region.
- [ ] Postgres backups + point-in-time recovery enabled and **a restore
      actually tested**.
- [ ] Log shipping off-platform — FINTRAC record-keeping runs to 5 years;
      Railway Hobby retains 7 days.

Known scaling blockers (must be fixed before running >1 replica):

- [ ] socket.io uses the default **in-memory adapter**. With multiple replicas,
      a notification emitted on one instance never reaches a user connected to
      another. Needs `@socket.io/redis-adapter` + Redis.
- [ ] `TransfersScheduler` runs a `setInterval` in **every** instance. The
      compare-and-swap guard in `TransfersService.advance()` keeps this
      *correct* (no double-advance), but every replica duplicates the polling
      work. Needs a single-leader lock or a real job queue.
