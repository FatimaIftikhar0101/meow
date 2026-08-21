# Shipping updates

Two clients, two update mechanisms, two very different sets of constraints.

Both are wired in the code. Neither can actually deliver an update until the
steps marked **you** below are done, because each needs a credential or a
hosting decision that is not a developer's to make.

---

## 1. The mobile app — over-the-air JavaScript

### What it can and cannot ship

| Change | How it reaches a phone |
|---|---|
| A screen, a label, a bug in the send flow, a pricing rule | **OTA.** Minutes. |
| A new Expo/React Native SDK, a native module, a permission | Store build. Days. |
| An app icon, the splash screen, anything in `app.json` native config | Store build. |

This is the whole point and the whole limit. It is worth being precise about it
with management, because "we can push fixes instantly" is true of about eighty
per cent of what will actually go wrong and false of the rest.

### Why it cannot brick a phone

`runtimeVersion` is set to the `fingerprint` policy. Expo hashes the native
side of the project — every native module, every config plugin, the SDK version
— and an update is only ever offered to a binary whose fingerprint matches.

That guard is not theoretical. Without it, a JS bundle that calls a native
method the installed APK does not contain crashes on launch, every launch, and
the person cannot get out of it: the app dies before it can download a fix. The
fingerprint policy makes that state unreachable, at the cost of forcing a store
build whenever native code changes — which is the right trade.

### Why nothing reloads by itself

`checkAutomatically: ON_LOAD` with `fallbackToCacheTimeout: 0` means the app
always starts instantly from the bundle it has and fetches any new one in the
background. A downloaded update applies on the next cold start, by itself.

`Updates.reloadAsync()` is never called automatically — see the reasoning in
[`mobile/lib/updates.tsx`](../mobile/lib/updates.tsx). Short version: this app
moves money, and swapping the JS bundle under someone who has just pressed Send
tears down every screen and every piece of unsaved state. The banner on Home
offers a restart; taking it is the person's choice.

### Publishing an update

```bash
cd mobile && npx eas update --branch production --message "what changed"
```

Channels map to the build profiles in `eas.json`. Publish to `preview` first and
check it on a real handset — an OTA update reaches every phone at once and there
is no staged rollout on the free tier.

**Rolling back** is republishing a known-good update, not deleting a bad one:

```bash
npx eas update:republish --branch production --group <previous-update-group-id>
```

### Steps that need **you**

1. **Confirm the EAS account owns this project.** `app.json` points updates at
   `https://u.expo.dev/3320840f-a18a-4297-a775-cd122f8fc3ff`, taken from the
   `projectId` already in the config. `npx eas whoami` should show the account
   that owns it.
2. **Build once with `expo-updates` included.** The library was added today, so
   it is native code that is not in the current APK. Until a new build is
   installed, OTA is inert — the running app has no updater in it at all. This
   needs an EAS build, which I have not started.
3. **Decide the release channel policy.** Right now `production` is the obvious
   default. If management wants a pilot group, that is a second channel and a
   second build profile.

---

## 2. The desktop panel — full binary replacement

### Why this matters more than it looks

A web app is whatever the server last served. A desktop app is whatever each
machine last installed. Without an updater, an operations workstation can sit on
a build from six months ago, and nobody finds out until it does something wrong
with somebody's money.

The panel was made a desktop app for the OS credential store. The cost of that
decision is that retiring an old build stops being automatic. This is how it
gets paid.

### Two different signatures, both needed

This trips people up, so it is worth stating plainly:

| | What it is | What it prevents |
|---|---|---|
| **Updater signature** (minisign, `tauri signer`) | A key pair we generate. The app refuses any update not signed by the matching private key. | A compromised CDN or a hijacked release pushing code into the back office. |
| **Code-signing certificate** (Authenticode, bought from a CA) | An identity certificate issued to the company. | Windows SmartScreen warning every colleague that the installer is from an unknown publisher. |

Neither substitutes for the other. The first is free and takes a minute. The
second costs roughly $200–400 a year, needs company identity documents, and has
lead time — it is backlog item #28 and it is a purchasing decision.

An **EV** certificate skips the SmartScreen reputation-building period
entirely; a standard OV certificate still gets warned about until enough
installs accumulate. For software handed to a company's staff, EV is usually
worth the difference.

### Steps that need **you**

1. **Generate the updater key pair:**

   ```bash
   cd admin && npm run tauri signer generate -- -w "$HOME/.tauri/meow.key"
   ```

   Put the **public** key into `plugins.updater.pubkey` in
   `src-tauri/tauri.conf.json` — it is currently an empty string, which is what
   keeps the updater inert and silent rather than half-configured.

   The **private** key never enters this repo. Anyone holding it can ship signed
   code to every installed copy of the back office, so it belongs in the release
   pipeline's secret store and nowhere else. If it leaks, every installed panel
   must be replaced by hand, because the old key is baked into them.

2. **Releases are hosted on GitHub Releases.** Decided 2026-08-21, and the
   endpoint in `tauri.conf.json` is already set to it:

   ```
   https://github.com/FatimaIftikhar0101/meow/releases/latest/download/latest.json
   ```

   Free, already where the code lives, and `tauri-apps/tauri-action` generates
   the signed `latest.json` as part of the release. The repository is **public**,
   so the plain URL works — against a private repo the updater would need a token
   on every download and this would fail.

   Worth knowing rather than acting on: a public repository is a reasonable place
   for this code, but it is a decision somebody made, and whoever takes the
   product over should be told. Nothing secret is in it — `*.local.md` and
   `*.local.json` are gitignored, and every credential lives in Railway or EAS.

3. **Set the signing key in CI:**

   ```
   TAURI_SIGNING_PRIVATE_KEY           the key file's contents
   TAURI_SIGNING_PRIVATE_KEY_PASSWORD  the passphrase, if one was set
   ```

4. **Bump two versions together.** `src-tauri/tauri.conf.json` `version` is what
   the updater compares. `Cargo.toml` `version` is what the binary reports. They
   are separate fields and drifting them apart produces an update that installs
   and then offers itself again forever.

### What the manifest looks like

The endpoint must serve this shape. `tauri-action` writes it; hand-rolling it is
possible but the signature has to come from the `.sig` file next to the binary.

```json
{
  "version": "0.2.0",
  "notes": "What changed",
  "pub_date": "2026-08-21T10:30:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contents of the .sig file>",
      "url": "https://github.com/FatimaIftikhar0101/meow/releases/download/v0.2.0/Meow.Back.Office_0.2.0_x64-setup.nsis.zip"
    }
  }
}
```

`bundle.createUpdaterArtifacts` is already `true`, so `npm run desktop:build`
produces the updater artifact and its `.sig` alongside the MSI and NSIS
installers.

### Why the CSP does not need changing

The updater downloads in Rust, not in the webview, so the `connect-src` rule in
`tauri.conf.json` does not apply to it. Adding the release host there would be
harmless and pointless. Backlog item #27 — the CSP entry for the packaged
app's own origin — is a separate problem and still open.

---

## What "installed" means for each

| | Mobile | Desktop |
|---|---|---|
| Delivery | JS bundle, ~1–2 MB | Whole installer, ~10 MB |
| Applies | Next cold start, or on request | On request, restarts the app |
| Needs a store | No | No |
| Can ship native changes | No | Yes |
| Can be rolled back remotely | Yes, by republishing | No — only by releasing a higher version |

That last cell is the one to remember. A bad desktop release cannot be recalled;
it can only be superseded. Which is the argument for checking the panel build on
one machine before tagging the release, every time.
