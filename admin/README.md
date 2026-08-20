# Meow — back office

The desktop panel staff run the business from: operations, compliance, support
and administration. One app for every role; what a person sees is built from
the permissions the server sends, not from their role name.

Separate from the customer app in `mobile/`, sharing one backend.

---

## Running it

```bash
cd admin
npm install
npm run dev
```

Opens on <http://localhost:5183>.

It talks to the **deployed** backend by default. There is no local database on
most machines here, and a panel with nothing behind it cannot be judged.

Point it somewhere else with `VITE_API_URL` in `admin/.env.local`:

```
VITE_API_URL=http://localhost:3000
```

### Why requests go through `/api`

In development the app calls `/api/...` and Vite proxies that to the backend,
so the browser only ever sees one origin and CORS never arises.

The alternative was adding `http://localhost:5183` to `CORS_ORIGINS` on the
deployed backend — a production API answering a development origin, forever, to
solve a temporary problem. The proxy costs one config block and ships nowhere.

---

## Signing in

Staff only. `/auth/admin/login` refuses a customer account, and vice versa.

Two-factor is required, not offered. Until enrolment is finished, every route
behind `StaffGuard` returns 403 and the app shows the enrolment screen and
nothing else — there is no URL that gets past it, because the un-enrolled state
replaces the route table rather than redirecting within it.

The first administrator is appointed out of band, from the backend:

```bash
railway run npm run staff:bootstrap -- someone@example.com
```

That script refuses to run once an administrator exists. Everyone after them is
invited from **Staff & roles**, which emails a link to set a password and enrol.
No password is ever set by one person for another, and none is ever emailed.

---

## Why Tauri

The webview is wrapped as a desktop app for three reasons, in order of weight:

1. **No browser extensions.** A compliance analyst's Chrome, with whatever they
   have installed, has DOM access to a screen full of customer PII. A Tauri
   webview has no extension surface at all.
2. **The token lives in the OS keychain**, not in web storage that any XSS can
   read.
3. **Forced auto-update.** For a panel that can move money, being able to retire
   an old build matters.

**The app is written as a plain web SPA and wrapped.** The only Tauri-specific
code is keychain storage, auto-update and native notifications. If Tauri turns
out to be friction, the same source ships as a web build and loses only the
extension isolation — so that decision stays reversible.

### Running the desktop build

```bash
npm run tauri dev
```

Starts Vite and opens the webview against it. The first run compiles the Rust
side and takes a while; later runs are quick.

```bash
npm run tauri build
```

Produces an installer under `src-tauri/target/release/bundle/`.

**Unsigned builds trip SmartScreen on Windows** and look untrustworthy to the
staff installing them. An OV code-signing certificate is roughly $200–400 a
year and is a real prerequisite before handing this to anyone.

### What actually lives in Rust

Three commands, and nothing else: `save_token`, `load_token`, `delete_token`,
backed by the OS credential store. The frontend picks the keychain when
`isTauri()` and `sessionStorage` otherwise, so a browser build still runs —
that is what keeps the choice of Tauri reversible.

**Still open:** a packaged Tauri app loads from `tauri://localhost`, so either
that origin joins the backend's allowlist, or requests move to Tauri's HTTP
plugin, which issues them from Rust where CORS does not apply. The second is
tidier. It is not decided yet, and `src/lib/api.ts` says so at the line it
affects. The CSP in `tauri.conf.json` currently names the Railway origin
explicitly under `connect-src`, which will need revisiting alongside it.

---

## Layout

```
src/
  lib/
    api.ts            axios, 401 handling, error-message shaping
    auth.tsx          session, permissions, the two-step sign-in
    token-store.ts    in-memory mirror + durable store (keychain under Tauri)
    permissions.ts    the permission vocabulary — names only, no role map
  components/ui.tsx   button, field, card, pill, alert
  routes/             one file per screen
  nav.ts              sidebar entries and what each one costs
  Shell.tsx           the frame: sidebar, identity, sign out
  App.tsx             providers, and the three-state gate
```

### Two things worth knowing before editing

**Colour comes from tokens, never from a hex.** `index.css` defines the same
semantic roles as `mobile/theme/tokens.ts` — `canvas`, `ink`, `danger`,
`accent` — and Tailwind generates `bg-canvas`, `text-ink` from them. A literal
colour in a class name means a role is missing; add the role.

The names are jobs rather than colours for a reason recorded in the mobile
file: revision 2 was rejected for being too green and revision 3 replaced the
palette outright, and neither should have required touching a screen.

**The panel never decides what anyone may do.** `GET /auth/profile` returns a
permission list and the app renders from it. Hiding a link is courtesy — it
stops a colleague wasting time on a door that will not open. `PermissionsGuard`
on the server is the thing that actually refuses a request, and it is the only
thing that does.

### Dark mode

Deliberately absent, matching the app. Adding it means re-pointing the
variables in `index.css` under `prefers-color-scheme` and nothing else. Do not
add it half-finished: a panel that is dark in places is worse than one that is
light everywhere.
