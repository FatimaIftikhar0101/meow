/**
 * The permission vocabulary, mirroring backend/src/auth/permissions.ts.
 *
 * Duplicated rather than shared because the two are separate packages with
 * separate builds. That is a real cost, so it is bounded: this file is a list
 * of names and nothing else. **No role→permission map lives here.** The panel
 * never derives what someone may do — the server sends the answer on
 * `GET /auth/profile`, and this file only gives those strings a type so a
 * typo is a compile error instead of a silently missing menu item.
 *
 * If the backend adds a permission and this list is not updated, the effect is
 * a type error at the call site that wants it — not a security hole. Enforcement
 * is `PermissionsGuard`, always.
 */
export const PERMISSIONS = [
  'customer.read',
  'customer.note',
  'customer.suspend',
  'customer.unsuspend',
  'customer.pii_full',

  'kyc.read',
  'kyc.decide',
  'kyc.override',

  'transfer.read',
  'transfer.retry',
  'transfer.cancel',
  'transfer.refund',
  'transfer.force_fail',

  'ledger.read',
  'recon.run',

  'alert.read',
  'alert.adjudicate',
  'case.manage',
  'blocklist.read',
  'blocklist.write',

  'corridor.read',
  'corridor.write',
  'fee.write',
  'limit.write',

  'staff.read',
  'staff.write',
  'role.assign',
  'audit.read',
  'report.export',

  'approval.request',
  'approval.decide',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type StaffRole = 'support' | 'operations' | 'compliance' | 'admin';

/** Human labels for the roles, for the one screen that has to show them. */
export const ROLE_LABEL: Record<StaffRole, string> = {
  support: 'Support',
  operations: 'Operations',
  compliance: 'Compliance',
  admin: 'Administrator',
};
