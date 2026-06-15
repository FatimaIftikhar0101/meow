# Meow Security Audit

**Scope:** Pre-launch security audit of the Meow remittance backend (NestJS + Prisma + Postgres) ahead of restricted launch (Canada → India, Canada → Pakistan).

**Auditor's frame:** Treated this as a pen-test against a Canadian MSB about to move real money. Bar: bank-grade. Findings are concrete with `file:line` citations and exploit paths, not abstract best-practice gripes.

**Result summary**

| Severity | Count |
|---|---|
| Critical | 0 (after fixes in this pass) |
| High | 2 |
| Medium | 5 |
| Low | 4 |
| Informational | 9 (known launch gaps, not bugs) |

---

## Critical (0)

None remaining after the fixes applied in this pass.

### Fixed in this pass

**JWT secret hard-coded fallback** — `backend/src/auth/jwt.strategy.ts:21` and `backend/src/auth/auth.module.ts:16` had `?? 'dev-secret-change-me'`. If `JWT_SECRET` were ever empty (config bug, env load failure, accidental override) the app would silently accept tokens signed by a known string — full account takeover for anyone in the world. **Fix shipped:** both fallbacks now throw at boot. Defence in depth alongside Joi `.required()`.

**JWT secret length floor was 16 chars** — `backend/src/config/env.validation.ts:11`. 16-byte secrets are technically brute-forceable on commodity hardware over time. **Fix shipped:** bumped to `min(32)` (~256 bits of entropy). Migration note in env example.

**Customer transfer list was unbounded** — `backend/src/transfers/transfers.service.ts:58` previously did `findMany` with no `take`. A user with hundreds of transfers would scan and serialise them all on every dashboard load → memory + DB pressure → cheap DoS. **Fix shipped:** `take` capped to 100, dashboard pulls 50.

---

## High (2)

### H-1 JWT lifetime is 7 days — too long for money operations

`backend/src/config/env.validation.ts:13` defaults `JWT_EXPIRES_IN=7d`. Bank-grade practice is 5–15 minutes for the access token + a separate refresh token (rotated, short-lived bound to device fingerprint, revocable via the DB).

**Exploit path:** stolen token (XSS, malware, repo leak, browser-extension keylog) gives the attacker a full week of authenticated access to the victim's account, including `POST /transfers`, `POST /wallet/fund`, recipient mutation, password reset. The current `passwordChangedAt` check invalidates older tokens on password change, but the user has to *know* they're compromised and act first.

**Recommended fix:**
- Drop access-token lifetime to 15 minutes
- Add a refresh-token endpoint with rotation + DB-backed revocation
- Store refresh tokens in httpOnly + sameSite=strict cookies, not localStorage
- Add a sessions table so `passwordChangedAt`-style global revoke also covers refresh tokens

**Status:** known gap, scoped post-launch with the 2FA work.

### H-2 JWT lives in `localStorage` (XSS-exposed)

`lib/api.ts:7-11` reads the access token from `localStorage`. Any XSS on the customer pages can steal the token and replay it for the next 7 days.

**Exploit path:** an attacker who lands JS execution (third-party script, dependency compromise, stored XSS in a future recipient-name field) extracts the token from `localStorage` and uses it to drain the wallet over the JWT lifetime.

**Mitigation:** React escapes by default, so today the surface is third-party deps. Recommended fixes (post-launch):
- Move to `httpOnly` + `secure` + `sameSite=strict` cookie for the access token
- Add CSRF token to mutating endpoints once cookies are introduced
- Set a strict Content-Security-Policy via helmet (currently using defaults)

---

## Medium (5)

### M-1 No CSRF token on state-changing endpoints

Currently safe because we authenticate via `Authorization: Bearer` (browsers don't auto-attach this on cross-origin requests). If the auth scheme moves to cookies (see H-2), a CSRF token becomes mandatory before that change ships.

### M-2 Wallet-fund idempotency uses a description string, not an indexed key

`backend/src/wallet/wallet.service.ts:65` matches `description: \`idempotency:${key}\``. Not unique-constrained at the DB level. Two concurrent funds with the same key are serialised via the wallet `FOR UPDATE` and the second sees the first's row, returning 409 (verified safe under concurrency).

Risk is operational: anyone who tampers with `LedgerEntry.description` via direct DB edit (or a schema change) breaks idempotency silently. **Recommended fix:** add a nullable `idempotencyKey String? @unique` column to `LedgerEntry` and use a proper unique constraint instead of a string match. Migration is small.

### M-3 Admin search uses `email contains` without a hard cap on result-set memory

`backend/src/admin/admin.service.ts:42-65` calls `findMany` with `take: pageSize` capped at 100 by `Math.min(pageSize, 100)` in the controller (verified). OK as-is, but if pageSize were ever read directly from query without the cap, an admin endpoint could `?pageSize=10000000`. Re-verify the cap on every new admin endpoint added.

### M-4 Audit log filter accepts free-text `action` / `entityType`

`backend/src/admin/admin.controller.ts:99-110` and `admin.service.ts` build a `where` object with whatever the admin types. Prisma parameterises this so there's no SQLi. A malicious or compromised admin could still pin queries on indices that don't exist and slow the table. Low risk because only admin role can reach it.

### M-5 `default.mp4` (kitten asset) is publicly served at `/cats/default.mp4`

`public/cats/default.mp4` is shipped as a static asset to anyone who visits the app. Not a security risk per se — it's intentionally public marketing. Calling it out only because that file is also reachable without auth, which is correct but worth noting if any future asset replaces this and contains anything more sensitive.

---

## Low (4)

### L-1 `ADMIN_EMAILS` typo can mis-grant admin

Promotion to admin is keyed off `ADMIN_EMAILS` env var. A typo (`admin@meeow.com`) silently downgrades the rightful admin. Operational hazard, not a vulnerability. Mitigation: log the resolved admin emails at boot under INFO so ops can verify.

### L-2 Idempotency response leaks key existence across users

`backend/src/transfers/transfers.service.ts:127` returns 409 ("Idempotency key already used") if the key exists under a *different* userId. An attacker can probe for valid keys. Minor info leak — the keys are random UUIDs so guessing is computationally infeasible.

### L-3 Error message strings include internal status codes

`backend/src/transfers/transfers.service.ts:217` returns `"Cannot cancel transfer in status payout_processing"`. Leaks internal state machine to API consumers. Acceptable for a remit app (users need to see this), but flag for review if regulated.

### L-4 `bcrypt` rounds = 10

`backend/src/auth/auth.service.ts:18`. 10 is the Node `bcrypt` default and acceptable today, but a bank should be on 12. Each +1 round doubles the cost — tune until login takes ~250 ms on production hardware. Trivial fix when we have prod sizing.

---

## Verified safe

The following classes of issue were checked and found correctly handled:

| Check | Where | Notes |
|---|---|---|
| Every controller guarded | `auth.controller.ts:44, 51`, `wallet:18`, `recipients:22`, `transfers:19`, `corridors:7`, `compliance:15`, `admin:27` | Only `/auth/register`, `/auth/login`, `/auth/admin/login`, `/health`, `/` are intentionally unguarded |
| Admin routes double-guarded | `admin.controller.ts:27` | `@UseGuards(JwtAuthGuard, AdminGuard)` — JWT validated before role checked |
| Suspended user rejected | `jwt.strategy.ts:38-40` | `ForbiddenException('Account suspended')` blocks any request, not just login |
| Token revocation on password change | `jwt.strategy.ts:41-46`, `auth.service.ts:143-167` | `passwordChangedAt` bumped on change; JWTs with older `iat` rejected |
| Role tampering on register | `auth/dto/register.dto.ts` + `main.ts:14-19` | DTO doesn't include `role` or `suspended`; `whitelist: true` + `forbidNonWhitelisted: true` strip and reject unknown fields |
| Login rate limit | `auth.controller.ts:21, 25, 31` | `@Throttle({ default: { limit: 5, ttl: 60000 } })` on register, login, admin/login. Brute force takes 5 tries/min/IP |
| Bcrypt constant-time compare | `auth.service.ts:84, 146` | `bcrypt.compare` is constant-time by design |
| Money in Decimal end-to-end | `wallet.service.ts`, `transfers.service.ts`, `corridors.service.ts` | `Prisma.Decimal` throughout. No `parseFloat`/`Number` conversions on amounts before persistence |
| Overdraft race closed | `transfers.service.ts:130-141` | `SELECT FOR UPDATE` on wallet row, balance computed inside the transaction, debit recorded before lock releases |
| Daily velocity enforced inside lock | `transfers.service.ts:138, 393-419` | `assertDailyVelocityLocked` called after `FOR UPDATE`, against the same `tx` |
| Wallet fund race closed | `wallet.service.ts:58-89` | Same pattern — `FOR UPDATE`, then idempotency check, then daily cap check, then ledger insert |
| Refund credits exact amount + fee | `transfers.service.ts:336-374` | `transitionWithRefund` writes a credit for `sendAmount` and a separate credit for `feeAmount` when non-zero |
| Cross-tenant read on transfer | `transfers.service.ts:67-78` | `transfer.userId !== userId` → `NotFoundException` (404, not 403, to avoid existence leak) |
| Cross-tenant read on recipient | `transfers.service.ts:86-90` | `recipient.userId !== userId` → `NotFoundException` |
| Cross-tenant edit on recipient | `recipients.service.ts` `ensureOwned` | same pattern |
| Scheduler vs cancel race | `transfers.service.ts:transitionWithRefund` | Both paths converge on `updateMany({ where: { id, status: fromStatus } })` — only one wins; the loser's `count===0` short-circuits |
| KYC concurrent verify race | `compliance.service.ts:26-36` | Existence check moved inside `$transaction`; second concurrent call sees the first's record and returns the existing status |
| Admin cannot suspend admin | `admin.service.ts:112-114` | Explicit `if (user.role === 'admin') throw ForbiddenException` |
| Admin force-fail bounded | `transfers.service.ts:236-244` | Refuses on `delivered`/`failed`/`cancelled`, transitions via the refund path, audit log appended |
| Profile endpoint doesn't leak hash | `auth.service.ts:121-132` | Explicit `select` whitelist — `passwordHash` is never read |
| Error filter doesn't leak stacks | `common/filters/all-exceptions.filter.ts` | 5xx responses log the stack server-side but return only `{statusCode, error, message, requestId, path, timestamp}` to client |
| CORS pinned | `main.ts:13-15` | `origin: FRONTEND_ORIGIN`, not `*` |
| Helmet enabled | `main.ts:12` | Defaults include CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc. |
| Health check unthrottled | `health.controller.ts:9-11` | `@SkipThrottle()` — load balancers won't trip the global limit |
| `/health` is unauthenticated | `health.controller.ts` | Correct — load balancers need it to be open. No DB credentials returned, just `up`/`down` |
| Audit log written for state changes | (sampled across services) | Verified entries for `auth.register`, `auth.login`, `auth.admin_login`, `auth.change_password`, `wallet.fund`, `transfer.create`, `transfer.cancelled`, `transfer.failed`, `kyc.passed`, `kyc.failed`, `admin.user.suspend`, `admin.user.unsuspend`, `admin.kyc.passed`, `admin.kyc.failed`, `admin.transfer.force_fail`, `admin.corridor.update`, `recipient.create`, `recipient.update`, `recipient.delete` |
| SQL injection | Prisma everywhere | All queries parameterised. The one `tx.$queryRaw` (`FOR UPDATE`) takes a UUID via template literal — safe |
| Mass assignment on PATCH | `recipients/dto/update-recipient.dto.ts`, `admin/dto/update-corridor.dto.ts` | DTOs whitelist exact fields; global `forbidNonWhitelisted` rejects extras |
| UUID path params validated | All `:id` routes | `ParseUUIDPipe` — bad UUIDs fail at the pipe, never reach the service |

---

## Informational — known launch gaps (not bugs, but explicit)

These are deliberately out of scope for the V1 corridor launch. Track them on the post-launch backlog:

1. **No 2FA.** Especially on admin. Critical to add before any non-Canadian-resident traffic.
2. **Mock KYC provider.** `provider: 'mock'` in `compliance.service.ts`. Swap for Onfido / Persona / Trulioo before any real money. Compliance team owns selection.
3. **No real payment provider.** `/wallet/fund` is a no-cost top-up. Real version needs Stripe / Interac / ACH with PCI-compliant collection.
4. **No real payout provider.** State machine ticks on its own. Real version needs Nium / Thunes / Wise webhooks driving status transitions.
5. **No real sanctions screening.** `compliance.service.ts` has a hard-coded set of "high-risk countries". Real OFAC / UN / FINTRAC list ingestion required.
6. **No automated tests.** Suite framework is configured (Jest), no tests written. Money-path tests (`computeBalance`, `transfer create overdraft`, `transitionWithRefund`) are the priority.
7. **No log shipping.** `LoggingInterceptor` writes to stdout. Production needs Sentry (errors) + Datadog / CloudWatch (structured logs).
8. **No secrets manager.** Env vars in `.env`. Production needs AWS Secrets Manager / GCP Secret Manager with rotation.
9. **Single-instance scheduler.** `TransfersScheduler` is in-process. Multi-instance deploy needs BullMQ + Redis so only one node advances a given transfer.

---

## Verification of the launch-scope restriction

Before sign-off on the CA→IN + CA→PK launch:

- `backend/prisma/seed.ts`: only `CAD->PKR` and `CAD->INR` active; the remaining seeded corridors are inactive
- `CorridorsService.findActive` (`corridors/corridors.service.ts:23-33`): rejects inactive corridors with `BadRequestException`
- `TransfersService.create` calls `findActive`, then verifies `recipient.country` matches `corridor.toCountry` — so even if a hostile user submits `receiveCurrency: PHP`, the call rejects with `Corridor CAD->PHP not supported`
- Frontend `recipients` form drops Philippines from the country picker
- Frontend `send` page only knows PK + IN destination currencies

A user can never create a transfer outside the two launch corridors via any documented or undocumented endpoint path.

---

## Sign-off statement

After the fixes above, the system is in shape for a **closed-beta** launch of CA→IN and CA→PK transfers with the following pre-conditions:

- Real KYC + payment + payout providers wired (the four "mocks" replaced)
- Real sanctions screening live
- 2FA on admin accounts
- Production secrets in a manager, not `.env`
- Penetration test by an external firm
- Money-path tests written (overdraft, refund, race)

Nothing above blocks demo or pre-regulatory testing. Everything above blocks taking actual customer money.

— Senior Engineer review, June 2026
