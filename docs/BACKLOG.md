# Meow — backlog

Everything outstanding, in one place. The `#n` numbers are the ones I use in chat.

**Legend:** ⬜ not started · 🟨 in progress · ✅ done · ⛔ blocked on someone else

---

## Mobile app

| # | Item | Status |
|---|---|---|
| 16 | **Serpentine journey path** on the transfer-tracking screen. Done. Horizontal serpentine across three lanes, six stations on one screen, no scrolling. Path geometry is an explicit model of lines and quarter arcs with analytic arc-length, because `react-native-svg` has no `getPointAtLength`. Labels and route occupy disjoint x ranges so nothing can be struck through; timestamps moved to a status row above the path. | ✅ |
| 17 | **Integrate the kitten clips.** Done. Five states as animated WebP with real alpha, keyed from the ProRes masters by `scripts/key-clip.js`, which verifies its own output is genuinely animated and transparent before exiting. `playing` fires on arrival at a station; `travel` is mirrored when heading right, since the plane art faces left. Reduce Motion is honoured. | ✅ |
| 18 | **Google sign-in.** Working end to end on the phone. The missing piece was the Android OAuth client (package `com.meow.app` + the EAS keystore SHA-1) — nothing in the code, and no rebuild needed once created, since Google enforces the fingerprint check server-side. Also fixed a reporting bug that had hidden the cause: `errorMessage()` understood only axios errors, so every native Play Services rejection surfaced as the same generic sentence. | ✅ |
| 19 | **Outbound email.** Done. `RESEND_API_KEY` and `MAIL_FROM` are set on Railway and the boot log confirms `Mail transport: Resend HTTP API (from onboarding@resend.dev)`. Note that the shared test sender generally only delivers to the address the Resend account was registered with, so register the end-to-end test user with that address. | ✅ |
| 20 | **End-to-end money-path test** on the physical phone: register with referral → verify email → KYC → fund → add PK recipient → send → watch all six statuses live over the socket (~25s) → notification → PDF receipt. Then idempotency (kill mid-submit, retry, confirm one transfer and one debit) and session revocation. Unblocked: the backend is deployed, migrations applied, email working. | ⬜ |
| 21 | **Repoint Railway to `main`, then let me delete the old branches.** Everything now lives on `main` (fast-forward, no conflicts). Railway still watches `feat/react-native-app`; change it once to `main` and it never needs changing again. `claude/check-code-status-OZqFV` holds zero unique commits and can go immediately; `feat/react-native-app` and `feat/admin-panel` go after the deploy is green — never delete the branch a deployment is watching. Also delete the test account `meow-contract-check+…@example.com` from the deployed database. `.claude/launch.json` holds a machine-specific path and must stay uncommitted. | ⛔ you |
| 24 | **Wire up dark mode in the mobile app.** Not a design job: `mobile/theme/tokens.ts` already defines a complete `dark` scheme beside `light`, deliberately kept in step. What is missing is that nothing renders it — wrap the tree in `ThemeProvider` and swap `import { colors }` for `useTheme()` in the components that should react. Then check every screen, because a token that was never exercised in dark is where the contrast failures hide. Confirm with the client first: dark mode was scoped out of revision 1 and has not been agreed since. | ⬜ |
| 25 | **Dark mode for the back office**, once #24 lands and the client has agreed. `admin/src/index.css` mirrors the same roles as CSS variables; adding a `prefers-color-scheme` block re-points them and nothing else changes. Do not ship it half-finished — a panel that is dark in places is worse than one that is light everywhere. | ⬜ |

---

## Backend — validated findings, resolved

Re-verified against the actual code, not from memory. See `docs/admin-panel-plan.md` §8 for
detail and for the one finding I had to withdraw.

| # | Item | Status |
|---|---|---|
| 22a | **Transfers did not snapshot recipient details.** `Transfer` held only `recipientId`, and `recipients.update()` mutates the row in place — so editing a recipient retroactively rewrote what every past transfer said it did. Fixed: five snapshot columns on `Transfer`, populated at creation, with all six read sites (transfers, admin ×2, wallet) redirected to them. API response shape unchanged, so no client changes needed. Migration backfills existing rows. 5 regression tests added. | ✅ |
| 22b | **Bank account numbers were stored in plaintext.** Done. AES-256-GCM column encryption keyed from `ENCRYPTION_KEY`, applied to `Recipient.bankAccount` and the `Transfer` snapshot. Owners see their own numbers; staff get the last four only. Legacy plaintext rows are read transparently so the deploy can precede the backfill — run `scripts/backfill-encryption.ts` once afterwards — done, and verified: all 12 recipients and 14 transfers decrypt with the key production actually holds. 14 tests. | ✅ |
| 22c | **Audit log captured no before/after values.** Done. `writeAudit`/`writeStaffAudit` in `common/audit`, and all 21 call sites migrated — the staff variant requires reason, before and after in its type. Suspend/unsuspend now take a reason (both clients updated), KYC override's reason moves from optional to required, corridor updates gain one. Also fixed: audit writes inside transactions were not awaited. | ✅ |
| 22d | **Cascading deletes on financial records.** Done. `Wallet`, `Recipient`, `KycRecord` and both `Referral` sides now `Restrict` instead of `Cascade`. `Session` deliberately still cascades (operational state, not evidence) and `TransferEvent` still cascades from `Transfer` (an event has no meaning without its transfer). | ✅ |
| 22e | **`KycRecord` held no identity evidence.** Done at the structural level: 10 evidence columns added (verified name/DOB/address, document type, last-4 only, expiry, method, verbatim provider response, reviewer and review time). All nullable — the mock provider has nothing to put in them, so they fill when a real provider is wired, without a migration against live data. | ✅ |
| 23 | **Travel-rule fields on `Transfer`** — originator and beneficiary detail. Beneficiary side is now covered by 22a. Still needs originator detail and addresses; confirm the exact required field list against current FINTRAC guidance before finalising. | ⬜ |

---

## Admin panel — planned, not started

Full plan in `docs/admin-panel-plan.md`. Desktop app (Tauri), same backend, RBAC with
maker-checker. Build order:

| Step | Item | Status |
|---|---|---|
| 0 | Schema hardening (the #22 items above) | ✅ |
| 1 | RBAC foundation — `UserRole`, permission map, `PermissionsGuard`, staff TOTP MFA, staff management, `ADMIN_EMAILS` retired for an audited bootstrap script | ✅ |
| 2 | **Tauri shell.** The SPA is built and runs in a browser: staff sign-in with the two-step code, enrolment, permission-driven navigation, transfers, customers, audit, staff & roles. Still to wrap: Tauri scaffold, keychain token storage (currently `sessionStorage`), auto-update, native notifications, and the `tauri://localhost` CORS decision. | 🟨 |
| 3 | Operations — transfer queue, aging/SLA view, transfer detail, retry | ⬜ |
| 4 | Support — customer 360, lookup, masked PII with audited reveal, notes | ⬜ |
| 5 | Maker-checker — `ApprovalRequest`, request/approve flows, wire the gated actions | ⬜ |
| 6 | KYC queue + audit log UI | ⬜ |
| 7 | Ledger explorer | ⬜ |
| 8 | Compliance — rules engine, alerts, cases, blocklist | ⬜ |
| 9 | Sanctions screening — vendor integration + adjudication queue | ⛔ vendor |
| 10 | Finance and regulatory — reconciliation, FX/fee/limits, FINTRAC exports, dashboards | ⬜ |

Steps 1–7 are a usable back office. Steps 8–10 are what a regulator expects to see.

---

## Decisions parked with you

| Item | Note |
|---|---|
| **Screening vendor** | You are discussing with your team lead. Options: **OpenSanctions** (open data, self-hostable, no licence cost, you own match quality), **ComplyAdvantage** or **Sanctions.io** (maintained lists + PEP, common for remittance startups), **Refinitiv World-Check** / **Dow Jones** (enterprise). Whichever you pick, the adjudication queue and decision record stay ours — never let a vendor score auto-decline someone with no human record of why. |
| **Data residency** | Railway is in **US East (West Virginia)**. Fine for the dummy-money phase. Before real money moves, Canadian customer data in a US region is a question to put to whoever advises on the licence — relocating is far cheaper before launch than after. |
| **Funding rail** | Client to supply later; likely a third party handling actual movement. When it lands, use hosted fields or tokenisation so a card number never reaches our backend and PCI-DSS scope stays in the lightest bracket. |
| **Code signing** | Tauri desktop builds need a signing certificate or Windows SmartScreen will flag them for the staff installing. OV certificate is roughly $200–400/year. |
| **Design questions the client never answered** | Bundling a specific serif font; the added `#A34434` failure colour; whether dark mode is ever in scope (the dark half of the theme file is currently an empty stub). |

---

## Done

**Repo layout and branches, 2026-08-20.** The web app moved out of the repo root into
`web/`, so the root now holds only deployable things — `backend/`, `web/`, `mobile/`,
`admin/` — plus `docs/` and `scripts/`. All branches merged into `main` as a
fast-forward. `main` is now the only long-lived branch and the one Railway deploys;
everything else is short-lived and deleted after merge. See the README for why a
long-lived branch per app is what caused the tangle.


Expo app scaffold · backend `POST /auth/google/native` · auth screens + native Google sign-in ·
home, greetings, KYC banner, wallet · recipients CRUD + send flow · activity list + live
tracking · notifications, referrals, profile, sessions · admin section behind role gate (to be
removed — see plan §9) · EAS build config, APK, README · generic semantic token system ·
revision-3 palette across all 28 screens · real `Brand.tsx` gold mark · splash centring and the
invisible login button · time-of-day greeting moved out of the dashboard · "Unknown OS" in
Devices & sessions · world map with real geographic pins · corridor never drawn when
unresolvable.
