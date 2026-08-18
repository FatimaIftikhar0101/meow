import { UserRole } from '@prisma/client';

/**
 * What each role is allowed to do.
 *
 * Roles are coarse and permissions are fine, deliberately. A guard asks for a
 * permission, never a role, so reshaping who can do what is an edit to the map
 * below rather than a hunt through every controller. It is the same separation
 * that made the theme re-skinnable: the thing code depends on is the semantic
 * name, not the value behind it.
 *
 * The split between `operations` and `compliance` is not organisational
 * tidiness. The person who processes a payment must not be the person who
 * clears it for anti-money-laundering purposes, and a licensed money services
 * business is expected to have a designated compliance function. Collapsing
 * them would be the first thing an audit picked up.
 */

export const PERMISSIONS = [
  // Customers
  'customer.read',
  'customer.note',
  'customer.suspend',
  'customer.unsuspend',
  /** See an unmasked account number. Deliberately separate from customer.read:
   *  reading a case file is not the same as reading someone's bank details. */
  'customer.pii_full',

  // Identity
  'kyc.read',
  'kyc.decide',
  'kyc.override',

  // Money in flight
  'transfer.read',
  'transfer.retry',
  'transfer.cancel',
  'transfer.refund',
  'transfer.force_fail',

  // Money at rest
  'ledger.read',
  'recon.run',

  // Financial crime
  'alert.read',
  'alert.adjudicate',
  'case.manage',
  'blocklist.read',
  'blocklist.write',

  // Configuration
  'corridor.read',
  'corridor.write',
  'fee.write',
  'limit.write',

  // The platform itself
  'staff.read',
  'staff.write',
  'role.assign',
  'audit.read',
  'report.export',

  // Four-eyes
  'approval.request',
  'approval.decide',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const SUPPORT: Permission[] = [
  'customer.read',
  'customer.note',
  'kyc.read',
  'transfer.read',
  'audit.read',
];

/**
 * Operations can move stuck money along, but only *request* anything that
 * returns funds — the approval comes from someone else. See `approval.decide`,
 * which they do not have.
 */
const OPERATIONS: Permission[] = [
  ...SUPPORT,
  'transfer.retry',
  'transfer.cancel',
  'ledger.read',
  'approval.request',
];

const COMPLIANCE: Permission[] = [
  ...SUPPORT,
  'customer.pii_full',
  'customer.suspend',
  'kyc.decide',
  'kyc.override',
  'alert.read',
  'alert.adjudicate',
  'case.manage',
  'blocklist.read',
  'blocklist.write',
  'ledger.read',
  'report.export',
  'approval.request',
  'approval.decide',
];

const ADMIN: Permission[] = [...PERMISSIONS];

const BY_ROLE: Record<UserRole, readonly Permission[]> = {
  customer: [],
  support: SUPPORT,
  operations: OPERATIONS,
  compliance: COMPLIANCE,
  admin: ADMIN,
};

/** Roles that belong to staff rather than to a customer of the product. */
export const STAFF_ROLES: readonly UserRole[] = [
  'support',
  'operations',
  'compliance',
  'admin',
];

export function isStaff(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return BY_ROLE[role] ?? [];
}

export function can(role: UserRole, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
