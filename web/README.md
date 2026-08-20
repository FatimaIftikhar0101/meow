# Meow — web

The Next.js customer site. Sign up, KYC, wallet, recipients, send, track.

```bash
npm install
npm run dev
```

Runs on <http://localhost:3001>, and expects the backend on
<http://localhost:3000>. Point it elsewhere with `NEXT_PUBLIC_API_URL` in
`.env.local` — see `.env.example`.

## Note for agents and anyone reading from memory

This is **not** the Next.js you may know. The version here has breaking changes
to APIs, conventions and file structure. Read the relevant guide in
`node_modules/next/dist/docs/` before writing code, and heed deprecation
notices. This is also stated in the repo-root `AGENTS.md`.

## Admin screens

`app/admin/` still exists here and is superseded by the desktop back office in
`admin/`. It is kept only until that ships, and should be deleted then rather
than left as a second, weaker way in. The same applies to the admin screens in
`mobile/app/(admin)/`.
