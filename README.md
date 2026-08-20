# Meow

Remittance from Canada to Pakistan and India. One backend, three clients.

```
backend/   NestJS + Prisma + Postgres — the API, the ledger, the money
web/       Next.js customer site
mobile/    React Native (Expo) Android app
admin/     React + Vite back office, wrapped by Tauri as a desktop app
docs/      backlog, plans, decisions
scripts/   repo-level helpers
```

Every folder at the root is a deployable thing or a place to keep notes. Nothing
else belongs here — the web app used to sit at the root, which made it look like
the repo *was* the web app and left `backend/` and `mobile/` reading as
appendages of it.

---

## Running it

Postgres first, once, then leave it:

```bash
docker compose up -d
```

Then each app in its own terminal:

```bash
cd backend && npm run start:dev
```
```bash
cd web && npm run dev
```
```bash
cd admin && npm run dev
```

| What | URL |
|---|---|
| Web app | http://localhost:3001 |
| Back office | http://localhost:5183 |
| Backend API | http://localhost:3000 |
| Health check | http://localhost:3000/health |

The mobile app needs a dev-client APK rather than a port — see `mobile/README.md`.

Each app has its own `package.json` and its own `node_modules`. There is no
workspace tool tying them together, deliberately: they deploy separately, on
different schedules, and a shared lockfile would couple releases that have no
reason to be coupled.

---

## Branches

**`main` is the only long-lived branch, and it is what Railway deploys.** It
should always be in a state you would be happy to deploy, because it is
deployed.

Everything else is short-lived and named for the work, not for the app it
touches:

```
feat/…    a new capability          fix/…     a defect
chore/…   tooling, deps, cleanup    docs/…    documentation only
```

Branch from `main`, keep it small, open a PR, merge, **delete the branch**.

### Why not a long-lived branch per app

Because that is what this repo had, and it went wrong in a specific way. A
`feat/react-native-app` branch lived long enough to collect twenty-six commits,
including backend work that had nothing to do with mobile — so Railway had to
track a feature branch to deploy the API, and `main` sat months behind what was
actually running. A branch per app sounds tidy and produces exactly that.

A branch that only ever tracks one folder is also a merge conflict waiting to
happen, since the interesting changes are the ones that cross folders: an
endpoint plus the screen that calls it.

### When a branch is fully contained in another

If `git merge-base --is-ancestor A B` says A is inside B, then A holds nothing
of its own — every commit on it also exists on B. Delete it. Keeping it around
can only cause someone to branch from a stale copy.

One ordering rule: **never delete the branch a deployment is watching.** Merge
first, repoint the deployment, confirm a green build, then delete.
