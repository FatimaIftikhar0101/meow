import type { Permission } from './lib/permissions';

/**
 * What the sidebar can contain, and what each entry costs.
 *
 * The panel renders only the entries whose permission the signed-in staff
 * member holds, and registers only those routes — so there is no flash of a
 * page they are about to be bounced from, and no dead link.
 *
 * This is presentation, not enforcement. `PermissionsGuard` on the server is
 * what actually stops a request; hiding a link stops a colleague wasting time
 * on a door that will not open. Both are needed and only one is security.
 */
export interface NavItem {
  path: string;
  label: string;
  /** Omitted for pages every staff member can see. */
  permission?: Permission;
}

export const NAV: NavItem[] = [
  { path: '/transfers', label: 'Transfers', permission: 'transfer.read' },
  { path: '/customers', label: 'Customers', permission: 'customer.read' },
  { path: '/approvals', label: 'Approvals', permission: 'approval.request' },
  { path: '/audit', label: 'Audit log', permission: 'audit.read' },
  { path: '/staff', label: 'Staff & roles', permission: 'staff.read' },
];

export function visibleNav(can: (p: Permission) => boolean): NavItem[] {
  return NAV.filter((item) => !item.permission || can(item.permission));
}
