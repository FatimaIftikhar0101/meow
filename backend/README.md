# Meow Backend

NestJS backend for the Meow remittance app. Uses PostgreSQL via Prisma ORM.

## First-time setup

Prerequisites: Node 20+, PostgreSQL 16+ running locally with a database named `meow_dev`.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file from the template
cp .env.example .env
# Edit .env and set DATABASE_URL to your local Postgres connection string.

# 3. Run database migrations (creates all tables)
npm run db:migrate

# 4. Start the dev server
npm run start:dev
```

The server listens on `http://localhost:3000` by default.

## Useful scripts

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run start:dev`  | Start backend with hot reload                  |
| `npm run build`      | Compile TypeScript to `dist/`                  |
| `npm run db:migrate` | Apply pending Prisma migrations to your DB     |
| `npm run db:reset`   | Drop and recreate the database (destroys data) |
| `npm run db:studio`  | Open Prisma Studio (browse/edit data in a UI)  |

## Database schema

See [`prisma/schema.prisma`](./prisma/schema.prisma). Core tables:

| Table             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `User`            | Auth and user account                                      |
| `Wallet`          | One per (user, currency); balance computed from ledger     |
| `Recipient`       | People the user sends money to                             |
| `Corridor`        | Send/receive currency pairs with FX + fee config           |
| `Transfer`        | Money-movement records with state machine                  |
| `TransferEvent`   | Audit timeline for each transfer status change             |
| `LedgerEntry`     | Double-entry ledger; balances are derived, not stored      |
| `KycRecord`       | KYC/compliance records (mock provider, swap to real later) |
| `AuditLog`        | Required for FINTRAC compliance                            |

## Architecture notes

- **Money fields use `Decimal`**, never `float`. Floats lose cents.
- **Balances are derived** from `LedgerEntry` rows, not stored on `Wallet`. This makes accounting auditable and prevents drift.
- **Every transfer carries an `idempotencyKey`** so duplicate API calls don't create duplicate sends.
- **Provider abstraction** (Nium, Thunes, etc.) plugs in behind a single interface; current implementation is a mock.
