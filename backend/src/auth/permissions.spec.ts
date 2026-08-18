import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import {
  PERMISSIONS,
  can,
  isStaff,
  permissionsFor,
  type Permission,
} from './permissions';
import { PermissionsGuard } from './guards/permissions.guard';

/**
 * Access control, so: assertions about what each role *cannot* do carry more
 * weight than what it can. A permission quietly appearing in the wrong role is
 * the failure mode worth catching.
 */

describe('roles', () => {
  it('treats only back-office roles as staff', () => {
    expect(isStaff('customer')).toBe(false);
    for (const r of ['support', 'operations', 'compliance', 'admin'] as UserRole[]) {
      expect(isStaff(r)).toBe(true);
    }
  });

  it('gives a customer no back-office permission at all', () => {
    expect(permissionsFor('customer')).toHaveLength(0);
  });

  it('gives admin every permission', () => {
    expect(permissionsFor('admin')).toHaveLength(PERMISSIONS.length);
  });
});

describe('segregation of duties', () => {
  const denied = (role: UserRole, perms: Permission[]) =>
    perms.forEach((p) =>
      expect([role, p, can(role, p)]).toEqual([role, p, false]),
    );

  it('support can look but not touch', () => {
    expect(can('support', 'customer.read')).toBe(true);
    expect(can('support', 'transfer.read')).toBe(true);
    denied('support', [
      'transfer.refund',
      'transfer.cancel',
      'transfer.force_fail',
      'customer.suspend',
      'kyc.decide',
      'customer.pii_full',
      'corridor.write',
    ]);
  });

  it('operations can unstick payments but cannot clear them for AML', () => {
    expect(can('operations', 'transfer.retry')).toBe(true);
    expect(can('operations', 'transfer.cancel')).toBe(true);
    denied('operations', ['kyc.decide', 'kyc.override', 'alert.adjudicate', 'corridor.write']);
  });

  it('operations can request an approval but never grant one', () => {
    // The whole point of four-eyes: the maker cannot also be the checker.
    expect(can('operations', 'approval.request')).toBe(true);
    expect(can('operations', 'approval.decide')).toBe(false);
  });

  it('compliance owns identity and financial crime, not pricing or staff', () => {
    expect(can('compliance', 'kyc.override')).toBe(true);
    expect(can('compliance', 'alert.adjudicate')).toBe(true);
    expect(can('compliance', 'blocklist.write')).toBe(true);
    denied('compliance', ['corridor.write', 'fee.write', 'staff.write', 'role.assign']);
  });

  it('restores access only through an administrator', () => {
    // Suspending is a containment action compliance should be able to take
    // immediately; putting the account back is the reviewable half.
    expect(can('compliance', 'customer.suspend')).toBe(true);
    expect(can('compliance', 'customer.unsuspend')).toBe(false);
  });

  it('keeps unmasked account numbers away from support and operations', () => {
    expect(can('support', 'customer.pii_full')).toBe(false);
    expect(can('operations', 'customer.pii_full')).toBe(false);
    expect(can('compliance', 'customer.pii_full')).toBe(true);
  });

  it('lets nobody but an administrator assign roles', () => {
    for (const r of ['customer', 'support', 'operations', 'compliance'] as UserRole[]) {
      expect(can(r, 'role.assign')).toBe(false);
    }
    expect(can('admin', 'role.assign')).toBe(true);
  });
});

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  const ctx = (user: { role: UserRole } | undefined, required?: Permission) => {
    jest
      .spyOn(Reflector.prototype, 'getAllAndOverride')
      .mockReturnValue(required);
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as never;
  };

  afterEach(() => jest.restoreAllMocks());

  it('allows a route that declares no permission', () => {
    expect(guard.canActivate(ctx({ role: 'support' }, undefined))).toBe(true);
  });

  it('allows a role that holds the permission', () => {
    expect(guard.canActivate(ctx({ role: 'compliance' }, 'kyc.override'))).toBe(true);
  });

  it('refuses a role that does not', () => {
    expect(() => guard.canActivate(ctx({ role: 'support' }, 'kyc.override'))).toThrow(
      ForbiddenException,
    );
  });

  it('names the missing permission', () => {
    // This endpoint is only reachable by authenticated staff, so a bare
    // "forbidden" just turns into a support ticket.
    expect(() => guard.canActivate(ctx({ role: 'support' }, 'transfer.refund'))).toThrow(
      /transfer\.refund/,
    );
  });

  it('refuses when there is no authenticated user', () => {
    expect(() => guard.canActivate(ctx(undefined, 'customer.read'))).toThrow(
      ForbiddenException,
    );
  });
});
