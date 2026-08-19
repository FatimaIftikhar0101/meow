# Meow — Android app

The native client for the Meow remittance product (Canada → Pakistan/India). Expo SDK 57,
expo-router, TypeScript. It talks to the existing NestJS backend; nothing about the money
logic lives here.

**No Android Studio is needed at any point.** Builds happen in Expo's cloud (EAS) and you
install the resulting APK straight onto the phone.

---

## What it does

Everything the backend supports, in one binary:

| Area | Screens |
|---|---|
| Auth | Welcome, log in, register (with referral code), forgot password, native Google sign-in |
| Home | Time-of-day greeting, corridor card with the live rate, quick actions, in-flight transfers, KYC banner |
| Send | Pick recipient → custom keypad with a live quote → review → result |
| Activity | List, then transfer detail with the live journey, full timeline, cancel, and a PDF receipt |
| Money | Wallet balance, add money, ledger history |
| People | Recipients list, add, edit, remove |
| Account | Profile, identity verification, devices & sessions, change password, referrals, notifications |
| Admin | Stats, users (suspend, KYC override), transfers (force-fail), corridors, audit log — only for `ADMIN_EMAILS` accounts |

Dark mode is deliberately **not** in this release. All colour lives in `theme/tokens.ts`,
shaped `{ light, dark }`, so adding it later is a swap in one file.

---

## Running it on your phone

### One-time setup

```bash
cd mobile && npm install
```

Then create the Expo account side of things (this is yours, not something the repo carries):

```bash
npx eas login
```

```bash
npx eas build:configure
```

### 1. Build the dev client (once)

```bash
npx eas build -p android --profile development
```

EAS generates a signing keystore, builds in the cloud, and gives you a download link.
Open it on the phone and install. **You only do this again when a native dependency
changes** — day-to-day JS changes hot-reload.

> Why a dev client instead of Expo Go: the native Google sign-in module is not bundled
> into Expo Go. Everything else about the workflow is identical.

### 2. Develop

```bash
npx expo start --dev-client
```

Scan the QR with the dev client. Every save reloads on the phone. Phone and PC on the same
Wi-Fi; add `--tunnel` if they are not.

The app points at the deployed Railway backend by default, so it works on mobile data with
no laptop involved. To run against a backend on this machine, copy `.env.example` to `.env`
and set `EXPO_PUBLIC_API_URL` to the machine's **LAN IP** — `localhost` would resolve to
the phone itself.

### 3. Build the shareable APK

```bash
npx eas build -p android --profile preview
```

Produces a plain APK you can hand to anyone to sideload. This is the one to demo with — it
runs with no Metro server.

---

## Google sign-in setup

The order matters, because the Android OAuth client needs the SHA-1 of the signing key and
EAS only generates that key on the first build.

1. Run the **development** build above. EAS creates the keystore.
2. Read the fingerprint:

```bash
npx eas credentials -p android
```

3. In **Google Cloud Console**, in the same project as the existing web client, create an
   **Android** OAuth client:
   - Package name: `com.meow.app`
   - SHA-1: the fingerprint from step 2

   No secret is produced and nothing needs pasting back. No rebuild is required either —
   Google checks the fingerprint server-side, so an APK already installed on a phone
   starts working the moment the client exists.

   **The Android client ID it gives you is never used in code.** There is no
   `androidClientId` option — `GoogleSignin.configure()` accepts only `webClientId` and
   `iosClientId`. The Android client is matched implicitly, by package name and
   fingerprint. Putting it in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` would break sign-in, by
   making the token’s `aud` stop matching what the backend verifies.

4. Put the **web** client ID (the backend's existing `GOOGLE_CLIENT_ID`) into
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — in `.env` locally, and in the `env` block of the
   relevant `eas.json` profile for cloud builds.

   It is the *web* client ID on purpose: `@react-native-google-signin` is configured with
   `webClientId`, so the ID token Play Services mints carries that as its `aud`, and that
   is what the backend verifies against. The Android client exists only so Play Services
   will issue a token to this package + signature at all.

5. Deploy the backend — it needs `POST /auth/google/native`, added alongside this app.

One Android client covers one signing key. Play App Signing re-signs the uploaded bundle
with a key Google holds, so publishing to the Play Store later needs a **second** Android
OAuth client carrying that fingerprint — from Play Console → Release → Setup → App
signing — alongside the EAS one, which keeps internal APK builds working.

If `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is empty the Google button is hidden and
email/password still works, so the app is usable before any of this is done.

Note that the key must be **absent or filled, never present-but-empty**: EAS rejects
`"EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": ""` outright with *"is not allowed to be empty"*,
and every `eas` command fails until it is removed — including `build:list`, which makes
it look like something worse has gone wrong.

---

## Layout

```
app/            expo-router routes; (auth), (app) tabs, (admin) role-gated
components/     the UI kit, the cat mark, the corridor card, the greeting scenes, the keypad
lib/            api client, auth context, sockets, money formatting, types, receipt
theme/tokens.ts every colour, radius and shadow — the single source
```

Two things in `lib/` are worth knowing before changing anything:

- **`money.ts`** — the backend serialises stored amounts as decimal *strings*, so no float
  ever touches a balance. This module keeps that promise: it formats and compares digits
  and never does float arithmetic. `/corridors/convert` is the one endpoint returning
  numbers, because a quote is not a balance.
- **Idempotency keys** — the send and fund screens mint a UUID when the screen *mounts*,
  not when the button is pressed. A retry after a timeout reuses it, so the backend returns
  the transfer it already made instead of sending the money twice.

## Checks

```bash
npx tsc --noEmit
```

```bash
npx expo export --platform android
```

The second one is worth running before a build: it forces a full bundle, which catches
import and routing mistakes that a typecheck cannot see.
