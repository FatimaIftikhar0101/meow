import { Prisma } from '@prisma/client';

/**
 * One way to write an audit entry.
 *
 * Before this existed, every service hand-rolled its own `auditLog.create`
 * call and the shape drifted: corridor updates stored the incoming DTO — new
 * values only, no prior state — user suspension stored nothing beyond the
 * action name, and recipient writes stored nothing at all. Twenty-one call
 * sites, no two agreeing on what an entry should contain.
 *
 * The audit log is the evidence a compliance-programme review runs on. "Who
 * changed this, from what, to what, and why" has to be answerable for every
 * staff action, and a convention that each call site is free to ignore does
 * not answer it. Hence a single writer with the shape in the type.
 *
 * NEVER pass secrets. Passwords, tokens, full account numbers and verification
 * codes must not appear in `before`, `after` or `metadata` — record that a
 * change happened, never the values. `redact()` below is for the cases where a
 * whole record is convenient to capture but some of its fields are sensitive.
 */

/** Anything that can write the AuditLog table: PrismaService, or the client
 *  handed to a `$transaction` callback. Most audit writes belong inside the
 *  same transaction as the change they describe. */
export interface AuditWriter {
  auditLog: {
    create: (args: {
      data: Prisma.AuditLogUncheckedCreateInput;
    }) => PromiseLike<unknown>;
  };
}

/** Who did it. `id` is nullable because some audited events (a failed login
 *  against an address with no account) have no user to attribute. */
export interface AuditActor {
  id?: string | null;
  email?: string | null;
}

/** Where the request came from, when a request is what triggered the entry. */
export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry {
  actor: AuditActor;
  /** Dotted and stable, e.g. "admin.user.suspend". Read by the audit UI's
   *  filters, so treat existing values as an interface. */
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  /** State before the change. Omit for events that change nothing (a login) or
   *  create something that did not exist (a registration). */
  before?: unknown;
  /** State after the change. Omit for deletions and for pure events. */
  after?: unknown;
  /** Why. Mandatory for staff actions against a customer — see
   *  `staffAudit()`, which will not compile without one. */
  reason?: string | null;
  /** Anything else worth keeping that is not a before/after pair. */
  metadata?: Record<string, unknown> | null;
  context?: AuditContext | null;
}

/** Prisma rejects `undefined` in a Json column but accepts `null`, and we want
 *  "not applicable" to be stored as an explicit null rather than an absent key
 *  so a reader can tell the two apart. */
function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value;
}

export async function writeAudit(
  db: AuditWriter,
  entry: AuditEntry,
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: entry.actor.id ?? null,
      actorEmail: entry.actor.email ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      beforeValue: json(entry.before),
      afterValue: json(entry.after),
      reason: entry.reason ?? null,
      metadata: json(entry.metadata),
      ipAddress: entry.context?.ip ?? null,
      userAgent: entry.context?.userAgent ?? null,
    },
  });
}

/**
 * A staff action taken against someone else's account.
 *
 * Identical to `writeAudit` except that `reason` and `before`/`after` are
 * required by the type. These are the entries a regulator actually asks to
 * see, and the ones most likely to be written carelessly, so the compiler
 * enforces what a convention could not.
 */
export function writeStaffAudit(
  db: AuditWriter,
  entry: AuditEntry & {
    actor: AuditActor & { id: string; email: string };
    reason: string;
    before: unknown;
    after: unknown;
  },
): Promise<void> {
  return writeAudit(db, entry);
}

/**
 * Copy an object, replacing the named fields with a marker.
 *
 * For capturing a whole record as before/after state when some of its fields
 * must not be retained in the log — a recipient's bank account, for instance,
 * which is encrypted at rest precisely so it does not sit in plaintext
 * elsewhere.
 */
export function redact<T extends Record<string, unknown>>(
  value: T,
  fields: readonly (keyof T)[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const f of fields) {
    if (out[f as string] !== undefined && out[f as string] !== null) {
      out[f as string] = '[redacted]';
    }
  }
  return out;
}
