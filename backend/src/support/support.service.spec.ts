import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SupportTicketEventKind, SupportTicketStatus } from '@prisma/client';
import { SupportService } from './support.service';

const customer = {
  id: 'customer-1',
  email: 'customer@meow.test',
  role: 'customer' as const,
  sid: 'session-1',
  mfaEnabled: false,
};
const staff = {
  id: 'support-1',
  email: 'support@meow.test',
  role: 'support' as const,
  sid: 'session-2',
  mfaEnabled: true,
};

function auditWriter() {
  return { create: jest.fn().mockResolvedValue({}) };
}

/** The service owns the boundaries; controllers only choose the authenticated actor. */
describe('SupportService', () => {
  it('refuses to link a support request to somebody else’s transfer', async () => {
    const prisma = {
      supportCategory: { findFirst: jest.fn().mockResolvedValue({ id: 'category-1' }) },
      transfer: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };
    const service = new SupportService(prisma as never, { create: jest.fn() } as never);

    await expect(
      service.createTicket(customer, {
        categoryId: 'category-1',
        transferId: 'not-my-transfer',
        subject: 'Where is it?',
        body: 'Please help me find this transfer.',
      }),
    ).rejects.toThrow('selected transfer is not yours');
    expect(prisma.transfer.findFirst).toHaveBeenCalledWith({
      where: { id: 'not-my-transfer', userId: customer.id },
      select: { id: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes a ticket read to its customer', async () => {
    const prisma = { supportTicket: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new SupportService(prisma as never, { create: jest.fn() } as never);

    await expect(service.getMine(customer.id, 'ticket-1')).rejects.toThrow('Support request not found');
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1', customerId: customer.id } }),
    );
  });

  it('reopens and unassigns a resolved request when its customer replies', async () => {
    const tx = {
      supportMessage: { create: jest.fn().mockResolvedValue({}) },
      supportTicket: { update: jest.fn().mockResolvedValue({}) },
      supportTicketEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: auditWriter(),
    };
    const prisma = {
      supportTicket: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ticket-1',
          status: SupportTicketStatus.resolved,
          assigneeId: staff.id,
        }),
      },
      $transaction: jest.fn(async (fn) => fn(tx)),
    };
    const service = new SupportService(prisma as never, { create: jest.fn() } as never);
    jest.spyOn(service, 'getMine').mockResolvedValue({ id: 'ticket-1' } as never);

    await service.replyAsCustomer(customer, 'ticket-1', 'I still need help, please.');

    expect(tx.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SupportTicketStatus.open,
          assigneeId: null,
          resolvedAt: null,
        }),
      }),
    );
    expect(tx.supportTicketEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: SupportTicketEventKind.reopened }),
    });
  });

  it('claims an unassigned open request with a conditional update', async () => {
    const tx = {
      supportTicket: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      supportTicketEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: auditWriter(),
    };
    const prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new SupportService(prisma as never, notifications as never);
    jest.spyOn(service, 'getForStaff').mockResolvedValue({ customer: { id: customer.id } } as never);

    await service.claim(staff, 'ticket-1');

    expect(tx.supportTicket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1', status: SupportTicketStatus.open, assigneeId: null },
        data: expect.objectContaining({ status: SupportTicketStatus.in_progress, assigneeId: staff.id }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      customer.id,
      'support_status',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ supportTicketId: 'ticket-1' }),
    );
  });

  it('reports an atomic-claim conflict instead of letting two staff take a request', async () => {
    const prisma = {
      $transaction: jest.fn().mockResolvedValue(false),
      supportTicket: { findUnique: jest.fn().mockResolvedValue({ id: 'ticket-1' }) },
    };
    const service = new SupportService(prisma as never, { create: jest.fn() } as never);

    await expect(service.claim(staff, 'ticket-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not let an unassigned staff member reply in another agent’s thread', async () => {
    const prisma = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-1', customerId: customer.id, status: SupportTicketStatus.in_progress, assigneeId: 'other-agent',
        }),
      },
    };
    const service = new SupportService(prisma as never, { create: jest.fn() } as never);

    await expect(service.replyAsStaff(staff, 'ticket-1', 'A reply')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
