import { Prisma } from '@prisma/client';
import { redact, writeAudit, writeStaffAudit } from './audit';

/**
 * Every audit entry in the application goes through these two functions, so
 * the shape they produce is the shape of the compliance record. That makes
 * them worth pinning down.
 */

function mockDb() {
  const create = jest.fn().mockResolvedValue({});
  return { db: { auditLog: { create } }, create };
}

describe('writeAudit', () => {
  it('records actor, action, target, both sides of the change and the reason', async () => {
    const { db, create } = mockDb();

    await writeAudit(db, {
      actor: { id: 'staff-1', email: 'ops@meow.app' },
      action: 'admin.user.suspend',
      entityType: 'user',
      entityId: 'cust-9',
      before: { suspended: false },
      after: { suspended: true },
      reason: 'Confirmed account takeover',
      context: { ip: '203.0.113.4', userAgent: 'Meow/1.0.0' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'staff-1',
        actorEmail: 'ops@meow.app',
        action: 'admin.user.suspend',
        entityType: 'user',
        entityId: 'cust-9',
        beforeValue: { suspended: false },
        afterValue: { suspended: true },
        reason: 'Confirmed account takeover',
        metadata: Prisma.JsonNull,
        ipAddress: '203.0.113.4',
        userAgent: 'Meow/1.0.0',
      },
    });
  });

  it('stores absent values as JSON null rather than dropping the key', async () => {
    const { db, create } = mockDb();

    // A creation has no prior state. "There was no before" and "nobody
    // recorded the before" are different facts, and a reader has to be able to
    // tell them apart — so the column is explicitly null, not missing.
    await writeAudit(db, {
      actor: { id: 'u-1' },
      action: 'transfer.create',
      after: { sendAmount: '250.00' },
    });

    const data = create.mock.calls[0][0].data;
    expect(data.beforeValue).toBe(Prisma.JsonNull);
    expect(data.afterValue).toEqual({ sendAmount: '250.00' });
    expect(data.actorEmail).toBeNull();
    expect(data.reason).toBeNull();
  });

  it('attributes an actorless event to nobody rather than failing', async () => {
    const { db, create } = mockDb();

    await writeAudit(db, { actor: {}, action: 'auth.login_failed' });

    expect(create.mock.calls[0][0].data.userId).toBeNull();
  });

  it('resolves only once the entry is written', async () => {
    // Most call sites write inside a Prisma interactive transaction. If this
    // returned before the insert settled, the transaction could commit without
    // its audit entry and nothing would report an error.
    let settled = false;
    const db = {
      auditLog: {
        create: () =>
          new Promise((res) =>
            setImmediate(() => {
              settled = true;
              res({});
            }),
          ),
      },
    };

    await writeAudit(db, { actor: { id: 'u-1' }, action: 'wallet.fund' });

    expect(settled).toBe(true);
  });
});

describe('writeStaffAudit', () => {
  it('writes the same shape as writeAudit', async () => {
    const { db, create } = mockDb();

    await writeStaffAudit(db, {
      actor: { id: 'staff-1', email: 'ops@meow.app' },
      action: 'admin.kyc.passed',
      entityType: 'user',
      entityId: 'cust-9',
      before: { status: 'failed' },
      after: { status: 'passed' },
      reason: 'Passport verified manually',
    });

    const data = create.mock.calls[0][0].data;
    expect(data.reason).toBe('Passport verified manually');
    expect(data.beforeValue).toEqual({ status: 'failed' });
    expect(data.actorEmail).toBe('ops@meow.app');
  });
});

describe('redact', () => {
  it('masks the named fields and leaves the rest', () => {
    expect(
      redact({ name: 'Ayesha', bankAccount: 'PK36SCBL0000001123456702' }, [
        'bankAccount',
      ]),
    ).toEqual({ name: 'Ayesha', bankAccount: '[redacted]' });
  });

  it('leaves an absent field absent rather than inventing a mask', () => {
    // Marking a null field '[redacted]' would claim a value existed.
    expect(redact({ name: 'Ayesha', bankCode: null }, ['bankCode'])).toEqual({
      name: 'Ayesha',
      bankCode: null,
    });
  });
});
