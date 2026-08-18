# Meow — back-office admin panel plan

A desktop application for staff who run the remittance business: operations, compliance,
support and administration. Separate from the customer mobile app, sharing one backend.

---

## 1. The word you were looking for

The concept is **role-based access control (RBAC)**, applied under the principle of **least
privilege** — every account gets the minimum permissions its job requires and nothing more.

The people are **back-office staff** or **operations staff**. Individually, by function:

- **Support agent** — customer-facing, mostly read
- **Operations analyst** — watches the transfer queue, unsticks payouts
- **Compliance analyst** (or **AML analyst**) — reviews flagged transactions, KYC, sanctions
- **Compliance officer** — the senior accountable role; in Canada, FINTRAC requires a
  designated one
- **Administrator** — manages staff, roles and configuration

Two further terms you will need, because they are the controls that make this safe:

**Segregation of duties.** The person who initiates a sensitive action is not the person who
approves it. An operations analyst can *request* a refund; they cannot approve their own.

**Maker-checker** (also called the **four-eyes principle**). The mechanism that implements
segregation of duties — one staff member proposes, a second independently approves, both are
recorded. This is standard in payments and it is the single most important control in this
whole plan.

---

## 2. What exists today

| Piece | State |
|---|---|
| `backend/src/admin/` | 12 routes, 418 lines. Stats, list/get users, suspend, unsuspend, KYC override, list/get transfers, force-fail, audit log, list/update corridors. |
| `AdminGuard` | Single binary check: `req.user.role !== 'admin'` → 403. |
| `UserRole` enum | **`customer` | `admin`.** Two values. This is the central gap. |
| `AuditLog` model | Exists and is well shaped — actor, action, entity, metadata, IP, user agent. Needs a real UI and needs before/after values. |
| `LedgerEntry` model | **Proper double-entry** with `txGroupId` pairing both legs. Excellent foundation; no UI at all. |
| `ADMIN_EMAILS` env | Role is re-synced from this list on every login. Fine for bootstrap, not a staff management system. |
| Admin screens in the mobile app | 5 screens under `mobile/app/(admin)/`. **These should be deleted — see §7.** |

So: roughly 15% of a back office exists, and the parts that exist are good. The ledger and
the audit log are the two hardest things to retrofit and both are already right.

---

## 3. Roles and permissions

**Roles are coarse and permissions are fine.** Store a role on the user, derive a permission
set from it in one map. Adding or reshaping a role then touches one file instead of every
guard — the same separation that made the theme re-skinnable.

### Proposed roles

```prisma
enum UserRole {
  customer
  support
  operations
  compliance
  admin
}
```

| Role | Can do | Explicitly cannot |
|---|---|---|
| `support` | Read customers and transfers, resend receipts and notifications, add account notes | Move money, decide KYC, see full PAN/account numbers |
| `operations` | All of support, plus retry payouts, work the stuck queue, *request* cancels and refunds | Approve their own requests, decide KYC, change corridors |
| `compliance` | Alert and case queues, KYC decisions, sanctions adjudication, blocklists, regulatory export | Change corridors, fees or staff |
| `admin` | Staff and role management, corridors, fees, limits, feature flags | Approve a maker-checker request they raised themselves |

Finance and treasury fold into `admin` for now; split them out when someone is actually doing
that job full time.

Keeping `compliance` separate from `operations` on day one is not over-engineering — the
person who processes a payment must not be the person who clears it for AML. That separation
is a regulatory expectation, not a nicety.

### Permission keys

One flat namespace, mapped to roles in a single file:

```
customer.read  customer.note  customer.suspend  customer.unsuspend  customer.pii_full
kyc.read  kyc.decide  kyc.override
transfer.read  transfer.retry  transfer.cancel  transfer.refund  transfer.force_fail
ledger.read  recon.run
alert.read  alert.adjudicate  case.manage  blocklist.read  blocklist.write
corridor.read  corridor.write  fee.write  limit.write
staff.read  staff.write  role.assign
audit.read  report.export
approval.request  approval.decide
```

Replace the blanket `AdminGuard` with a `@RequirePermission('transfer.refund')` decorator and
a `PermissionsGuard`. The existing guard stays for the handful of routes that really are
admin-only.

---

## 4. Functional scope

Tiered by when it becomes necessary. Tier 1 is required before real money moves; tier 2 before
a licence application survives scrutiny; tier 3 is the mature back office.

### Tier 1 — required before real money

**Operations queue**
- Live board of in-flight transfers grouped by status, driven by the existing sockets
- **Aging / SLA view** — anything sitting in `payout_processing` past a threshold. This is the
  screen operations lives in all day; design it first, not last
- Retry a failed payout, cancel, request a refund
- Transfer detail: full timeline, both ledger legs, provider reference, failure reason

**Customer 360 for support**
- Lookup by email, phone or transfer reference
- One page: profile, KYC status, wallet balances, transfer history, sessions and devices,
  notifications sent, referral state
- Account notes, resend receipt, resend verification
- **PII masked by default**, revealed per-field on click, and every reveal is audited

**KYC review queue**
- Pending records with submitted evidence
- Approve / reject / request more information, with a **mandatory reason**
- Override requires maker-checker

**Ledger explorer**
- Every `txGroupId` with both legs side by side, filterable by wallet, transfer, type, date
- A per-wallet balance that recomputes from entries, so a mismatch is visible rather than
  hypothetical

**Audit log UI**
- Filter by actor, action, entity, date range
- Extend `AuditLog.metadata` to carry **before and after values** and the reason text

**Maker-checker**

```prisma
model ApprovalRequest {
  id             String   @id @default(uuid())
  action         String            // "transfer.refund", "kyc.override", ...
  entityType     String
  entityId       String
  payload        Json
  reason         String            // mandatory, free text
  requestedById  String
  requestedAt    DateTime @default(now())
  status         ApprovalStatus @default(pending)
  decidedById    String?
  decidedAt      DateTime?
  decisionReason String?
  expiresAt      DateTime
}
```

Enforced in the service layer, never only in the UI: `decidedById != requestedById`, always.
Gated actions — refunds above a threshold, any KYC override, unsuspending a user, corridor
rate changes, blocklist removal, and staff role changes.

**Staff security**
- **TOTP MFA mandatory for every staff role.** Not optional, not a setting. A back office with
  password-only login on a money product is the finding that ends an audit
- Short session TTL with re-auth prompted before privileged actions
- Staff auth stays on its own endpoint (`/auth/admin/login` already exists)
- Optional IP allowlist

### Tier 2 — compliance

**Transaction monitoring rules engine**
- Velocity — N transfers or X total within a rolling window
- Threshold — single transfer over a configured amount
- **Structuring** — several transfers landing just under a reporting threshold
- Unusual corridor for this customer, dormant account suddenly active, many senders paying one
  recipient
- Rules configurable per corridor, each with its own severity

**Sanctions and PEP screening**
- Screen sender and recipient at transfer creation, and re-screen everyone when a list updates
- **Canadian lists are the legal obligation**, not the generic international set: the
  Consolidated Canadian Autonomous Sanctions List, the UN Act regulations, and the Criminal
  Code terrorist entity listings. Screen OFAC as well if any payment path touches USD
  correspondent banking, and the destination country's own list where one exists
- Fuzzy name matching produces *candidates*, not verdicts — an analyst adjudicates each as
  true or false positive, and the decision is recorded and reusable

**Case management**
- An alert becomes a case; a case is assigned, worked, noted and dispositioned
- Attach evidence, link related customers and transfers
- Full history — who looked, when, what they concluded

**Blocklist**
- Scoped entries: user, email, phone, bank account, IP, device, recipient name
- Every addition and removal carries a reason; removal is maker-checker

### Tier 3 — regulatory and finance

- **FINTRAC reporting** (Canada is the send side): EFTR for electronic transfers at or above
  CAD 10,000, LCTR for large cash, STR for suspicious transactions. Generate, review and export
- **Reconciliation** — internal ledger against payout-provider settlement files; a worklist of
  mismatches classified as missing-internal, missing-provider or amount-mismatch
- **FX and fee management** — rate source, spread, margin per corridor, full rate history
- **Limits** — per transaction, per day, per month, by corridor and by customer tier
- **Float and liquidity** per corridor — can we actually pay out PKR right now
- **Dashboards** — volume, revenue, corridor mix, success rate, mean settlement time

---

## 5. Tech stack

### Same backend — yes, without qualification

One backend, one database, one ledger. Two services touching the same money means two sources
of truth and a reconciliation problem you built for yourself. The admin surface already lives
in `backend/src/admin/`; this extends it rather than replacing it.

What changes on the backend:
- `admin` module grows into `admin`, `compliance-ops`, `approvals` and `reporting` modules
- `PermissionsGuard` replaces the blanket `AdminGuard`
- Staff routes get their own throttle profile and can be network-restricted later
- New models per §4

### Desktop shell — Tauri v2, with one important caveat

**Yes, Tauri.** But the reasons that actually justify a desktop app here are narrower than
they first appear, so it is worth being precise:

**Genuine wins**
- **No browser extensions.** A compliance analyst's Chrome, with whatever extensions they have
  installed, has DOM access to a screen full of customer PII. A Tauri webview has no extension
  surface at all. This is the strongest argument by some distance.
- **Token in the OS keychain**, not `localStorage` — which any XSS can read.
- **Forced auto-update.** You control which version staff are running. For a panel that can
  move money, being able to kill an old build matters.
- **Multi-window.** An analyst wants a case open beside the ledger. Browsers do this badly.
- Small binary (~10MB) and low memory next to Electron's bundled Chromium.

**Real costs, stated plainly**
- Needs the Rust toolchain, and **builds are per-OS** — Windows builds need a Windows machine
  (fine, you are on Windows 10), macOS would need a Mac or CI.
- **Code signing.** An unsigned Windows binary trips SmartScreen and looks untrustworthy to
  the staff installing it. An OV certificate is roughly $200–400 a year. Budget it.
- Tauri uses the OS webview — WebView2 on Windows — so rendering differs across platforms in a
  way Electron's bundled Chromium does not.

**The caveat that de-risks all of it: build the frontend as a plain web SPA and wrap it.**

Write no Tauri-specific code except three things — auto-update, native notifications for the
alert queue, and keychain token storage. Everything else is an ordinary web app. If Tauri
turns out to be friction, you ship the same codebase as a web build and lose nothing but the
extension isolation. That decision stays reversible for the whole project.

### Frontend

| Concern | Choice | Why |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Tauri wants a static SPA. Vite is the right tool; Next.js is a server framework and would fight the shell for no gain. It also sidesteps the Next.js version breakage flagged in `AGENTS.md`. |
| Routing | React Router | Plain client routing. |
| Data | **TanStack Query** | This is a data-heavy dashboard — caching, background refetch, optimistic updates and request dedup all matter. |
| Tables | **TanStack Table** | An admin panel is 80% tables. Sorting, filtering, pagination, column pinning, virtualised rows. |
| Styling | Tailwind with CSS variables bound to the **same semantic token names as `mobile/theme/tokens.ts`** | The client's palette carries over for free, and a future theme change stays one file per platform. |
| Realtime | `socket.io-client` | The transfer and notification gateways already exist. |
| Charts | Recharts | Sufficient for volume and mix. |

### Placement

`admin/` at the repo root, beside `backend/`, `mobile/` and the Next.js client — its own
`package.json`, one git history, one API contract.

---

## 6. Build order

0. **Schema hardening** — encrypt `Recipient.bankAccount` at rest, replace cascading deletes
   with soft deletion plus retention, give `KycRecord` somewhere to hold evidence, add
   before/after values to `AuditLog`. See §8. This comes first because the panel's screens are
   shaped by it and every one of these is cheaper before there is production data.
1. **RBAC foundation** — extend `UserRole`, add the permission map, `PermissionsGuard`, staff
   TOTP MFA, staff management endpoints. Backend only, fully tested.
2. **Tauri shell** — scaffold, auth against `/auth/admin/login` + TOTP, keychain storage,
   auto-update, the app frame and navigation.
3. **Operations** — transfer queue, aging/SLA view, transfer detail, retry.
4. **Support** — customer 360, lookup, masked PII with audited reveal, notes.
5. **Maker-checker** — `ApprovalRequest`, the request and approve flows, wire the gated actions
   through it.
6. **KYC queue** and the audit log UI.
7. **Ledger explorer.**
8. **Compliance** — rules engine, alerts, cases, blocklist.
9. **Sanctions screening** — provider integration and the adjudication queue.
10. **Finance and regulatory** — reconciliation, FX/fee/limits, FINTRAC exports, dashboards.

Steps 1–7 are a usable back office. Steps 8–10 are what a regulator expects to see.

---

## 7. Regulatory posture — a licensed Canadian MSB

Meow will move real money under a licence, with Canada as the send side — but not yet. The
current build runs on dummy money and goes to the client for approval; the client then supplies
the licences and the payment integrations.

That sequencing changes *what we build now*, not *how well*. The split is:

- **Build now** — anything structural. Encryption at rest, retention guarantees, snapshotted
  financial records, audit trails with before/after values, the permission model,
  maker-checker, the case-management data model. All of it is far cheaper before there is
  production data, and none of it depends on a licence.
- **Defer honestly** — only what genuinely cannot be done yet: a screening vendor nobody has
  chosen, a payment rail the client has not specified, a FINTRAC reporting schema that must be
  confirmed against current guidance rather than built from recollection.

The distinction to avoid is the lazy one — "it's only dummy money, so this can wait". Every item
in §8 gets fixed now.

**A caveat I want stated plainly.** I am confident about the *shape* of these obligations. I am
not a substitute for a compliance advisor, and FINTRAC's reporting schemas and thresholds change
— the exact formats, field lists and submission mechanism must be confirmed against current
FINTRAC guidance before anything is built to them. Treat the list below as the set of questions
to take to your compliance counsel, not as the answers.

### Obligations that shape the build

| Obligation | What it means for the code |
|---|---|
| **MSB registration** with FINTRAC before operating | Business prerequisite, not code — but nothing should go live before it exists |
| **Five-year record retention** | **No hard deletes anywhere.** See §8 — the schema currently cascades deletes |
| **EFTR** — international electronic funds transfers at or above CAD 10,000 must be reported | Needs originator and beneficiary detail the `Transfer` model does not currently carry |
| **24-hour aggregation rule** | Several transfers by one person inside 24 hours aggregate toward the threshold — this is a query and a rule, not a per-transfer check |
| **STR** — suspicious transactions, no threshold | The case management workflow in tier 2 *is* the STR pipeline |
| **Travel rule** — originator and beneficiary information must travel with the transfer | Schema change on `Transfer` and `Recipient` |
| **Identity verification** at the record-keeping threshold | `KycRecord` currently stores a status and a provider reference and no evidence at all |
| **Compliance program** — appointed officer, written policies, risk assessment, training, and a biennial effectiveness review | The panel must be able to *produce evidence* for a review: who decided what, when, and why |

### Screening

Screening must be a real vendor integration, not a mock. Realistic options at your stage:

- **OpenSanctions** — open data, self-hostable, no licence cost. Good starting point; you own
  the matching quality
- **Sanctions.io** or **ComplyAdvantage** — commercial APIs with maintained lists, fuzzy
  matching and PEP coverage. ComplyAdvantage is the more common choice for remittance startups
- **Refinitiv World-Check** / **Dow Jones** — enterprise tier, priced accordingly

Whichever you pick, the adjudication queue and the decision record stay yours. Never let a
vendor's match score auto-decline a customer with no human record of the decision — that is the
thing a regulator will ask you to evidence.

### Two answers, and what follows from them

**Data residency — Railway is in US East (West Virginia).** Fine for the dummy-money phase;
nothing to do today. Before real customer data lands, this is a question for whoever advises on
the licence: Canadian personal and financial data held in a US region carries both a
cross-border disclosure obligation under PIPEDA and exposure to US lawful-access regimes.
Relocating a region is straightforward before launch and painful after. Flagging it now so the
decision is deliberate rather than inherited.

**Payment rails — client to specify, likely a third party handling actual movement.** Nothing
to build against yet. The one constraint worth fixing in advance: whatever the rail, use hosted
fields or tokenisation so a card number never reaches our backend. If a PAN ever touches these
servers the PCI-DSS scope expands from the lightest self-assessment bracket to something that
needs an auditor.

---

## 8. Schema findings — re-validated against the code

A first pass produced five findings. Re-checking each against the actual source rather than the
schema alone changed two of them: one was overstated and one was under-called. The corrected
set is below.

### 22a — Transfers do not snapshot recipient details · **valid, and the most serious**

`Transfer` stores `recipientId` and nothing else about the beneficiary. `recipients.update()`
mutates the recipient row in place. So **editing a recipient retroactively rewrites what every
past transfer to them says it did** — change a bank account number and a delivered transfer's
receipt now shows an account the money never went to.

This is wrong today, with dummy money, and has nothing to do with licensing. A financial record
must state what was true at the moment it was made. Fix: snapshot name, country, bank account,
bank name and bank code onto the `Transfer` at creation. That also lays the groundwork for the
travel rule, which needs the same data plus addresses.

I under-called this in the first pass by framing it as a future regulatory gap. It is a
present-tense correctness bug in the money record and in the PDF receipt.

### 22b — Bank account numbers stored in plaintext · **valid**

`Recipient.bankAccount` is a plain `String` holding an IBAN or local account number. There is no
encryption anywhere in the backend: no Prisma middleware or client extension, no `pgcrypto` in
any migration, nothing. Needs application-level encryption at rest with a managed key, masked
display by default in the panel, and an audited reveal. Encrypting the column later means
re-encrypting live data.

### 22c — The audit log captures no before/after values · **valid**

`AuditLog.metadata` exists but is used inconsistently. `admin.corridor.update` stores the
incoming DTO — the *new* values only. `admin.user.suspend` stores nothing. Every
`recipient.*` write stores nothing. No site anywhere records the prior value, and no site
records a reason.

For a compliance-programme effectiveness review you need prior value, new value and a mandatory
reason on every staff action. Worth hash-chaining the entries so tampering is detectable rather
than merely discouraged.

### 22d — Cascading deletes on financial records · **latent, not live — I overstated this**

My first pass said deleting a user "destroys their recipients and KYC history". That describes
a code path which **does not exist**: there are zero `.delete()` or `.deleteMany()` calls in the
entire backend. `recipients.remove()` is already a soft delete (`active: false`) and it refuses
outright when in-flight transfers exist. Nothing in the application deletes anything.

The finding is still worth acting on, but as a smaller thing than I claimed: `onDelete: Cascade`
on `Recipient` and `KycRecord`, and `onDelete: SetNull` on `AuditLog`, are a standing invitation.
The plausible future trigger is a privacy erasure request, where the obligation to erase collides
with the obligation to retain financial records for five years. Switching to `Restrict` makes the
guarantee explicit at the schema level rather than depending on nobody ever writing a delete.

### 22e — `KycRecord` holds no identity evidence · **valid, partly deferred**

It stores `status`, `provider`, `providerRef` and `reason`. Nothing about what identity was
verified, by what method, against what document, or what the provider returned.

With a mock provider there is no evidence to store yet, so the deferral is real — but the
*structure* is not. Add the columns now so the real provider integration is a code change rather
than a migration against live production data.

### Sequence

22a, 22c and 22d land now — they are correctness and structure, and cheap while the database is
still disposable. 22b lands now too, since encrypting an existing column is the one item that
gets materially harder with every real row. 22e adds structure now and content when a provider
is chosen.

---

## 9. One thing to undo

`mobile/app/(admin)/` — five admin screens currently ship inside the customer APK.

Every customer's phone carries the admin UI and the admin endpoint paths, recoverable from the
bundle by anyone who unzips it. The role gate stops it *rendering*, but it does not stop it
*being there*. Remove it when the desktop panel takes over. Admin code belongs in a binary that
only staff can install.
