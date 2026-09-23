import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SupportFaqStatus,
  SupportMessageSender,
  SupportTicketEventKind,
  SupportTicketStatus,
} from '@prisma/client';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeAudit } from '../common/audit/audit';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateSupportCategoryDto,
  CreateSupportFaqDto,
  CreateSupportTicketDto,
  ListSupportTicketsDto,
  UpdateSupportCategoryDto,
  UpdateSupportFaqDto,
} from './dto/support.dto';

const ticketInclude = {
  category: { select: { id: true, name: true, description: true } },
  transfer: {
    select: {
      id: true,
      recipientName: true,
      recipientCountry: true,
      sendAmount: true,
      sendCurrency: true,
      receiveAmount: true,
      receiveCurrency: true,
      status: true,
      createdAt: true,
    },
  },
  assignee: { select: { id: true, email: true } },
} satisfies Prisma.SupportTicketInclude;

/**
 * One support request has one immutable conversation and a small, explicit
 * lifecycle. A customer answer to a resolved request returns it to the shared
 * queue, rather than creating an almost-identical second ticket.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Only active categories and published answers may leave the staff desk. */
  async publishedHelp() {
    return this.prisma.supportCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        faqs: {
          where: { status: SupportFaqStatus.published },
          select: {
            id: true,
            question: true,
            answer: true,
            sortOrder: true,
            updatedAt: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async createTicket(customer: AuthUser, input: CreateSupportTicketDto) {
    const category = await this.prisma.supportCategory.findFirst({
      where: { id: input.categoryId, active: true },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('Choose an active help category');
    }

    if (input.transferId) {
      const transfer = await this.prisma.transfer.findFirst({
        where: { id: input.transferId, userId: customer.id },
        select: { id: true },
      });
      if (!transfer) {
        throw new BadRequestException('The selected transfer is not yours');
      }
    }

    const subject = input.subject.trim();
    const body = input.body.trim();
    if (!subject || !body) {
      throw new BadRequestException('Subject and message cannot be blank');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          customerId: customer.id,
          categoryId: category.id,
          transferId: input.transferId,
          subject,
          status: SupportTicketStatus.open,
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: created.id,
          authorId: customer.id,
          sender: SupportMessageSender.customer,
          body,
        },
      });
      await tx.supportTicketEvent.create({
        data: {
          ticketId: created.id,
          actorId: customer.id,
          kind: SupportTicketEventKind.created,
        },
      });
      await writeAudit(tx, {
        actor: { id: customer.id, email: customer.email },
        action: 'support.ticket.create',
        entityType: 'SupportTicket',
        entityId: created.id,
        after: { categoryId: category.id, transferLinked: Boolean(input.transferId) },
      });
      return created;
    });

    return this.getMine(customer.id, ticket.id);
  }

  async listMine(customerId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { customerId },
      include: {
        ...ticketInclude,
        messages: {
          select: { id: true, sender: true, body: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
    return tickets.map((ticket) => ({
      ...this.ticketSummary(ticket),
      latestMessage: ticket.messages[0] ?? null,
    }));
  }

  async getMine(customerId: string, id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, customerId },
      include: {
        ...ticketInclude,
        messages: {
          select: { id: true, sender: true, body: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          select: { id: true, kind: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Support request not found');
    return {
      ...this.ticketSummary(ticket),
      messages: ticket.messages,
      events: ticket.events,
    };
  }

  async replyAsCustomer(customer: AuthUser, id: string, rawBody: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, customerId: customer.id },
      select: { id: true, status: true, assigneeId: true },
    });
    if (!ticket) throw new NotFoundException('Support request not found');
    const body = rawBody.trim();
    if (!body) throw new BadRequestException('Message cannot be blank');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: customer.id,
          sender: SupportMessageSender.customer,
          body,
        },
      });
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data:
          ticket.status === SupportTicketStatus.resolved
            ? {
                status: SupportTicketStatus.open,
                assigneeId: null,
                resolvedAt: null,
                lastCustomerActivityAt: now,
                lastActivityAt: now,
              }
            : { lastCustomerActivityAt: now, lastActivityAt: now },
      });
      if (ticket.status === SupportTicketStatus.resolved) {
        await tx.supportTicketEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: customer.id,
            kind: SupportTicketEventKind.reopened,
          },
        });
      }
      await writeAudit(tx, {
        actor: { id: customer.id, email: customer.email },
        action:
          ticket.status === SupportTicketStatus.resolved
            ? 'support.ticket.reopen'
            : 'support.ticket.customer_reply',
        entityType: 'SupportTicket',
        entityId: ticket.id,
        before: { status: ticket.status, assigneeId: ticket.assigneeId },
        after: {
          status:
            ticket.status === SupportTicketStatus.resolved ? 'open' : ticket.status,
          assigneeId:
            ticket.status === SupportTicketStatus.resolved ? null : ticket.assigneeId,
        },
      });
    });

    return this.getMine(customer.id, id);
  }

  async listForStaff(staff: AuthUser, query: ListSupportTicketsDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where: Prisma.SupportTicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.assignment === 'mine') where.assigneeId = staff.id;
    if (query.assignment === 'unassigned') where.assigneeId = null;
    if (query.search?.trim()) {
      const needle = query.search.trim();
      where.OR = [
        { subject: { contains: needle, mode: 'insensitive' } },
        { customer: { email: { contains: needle, mode: 'insensitive' } } },
        { transfer: { recipientName: { contains: needle, mode: 'insensitive' } } },
        { transfer: { id: { equals: needle } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          ...ticketInclude,
          customer: { select: { id: true, email: true } },
          messages: {
            select: { id: true, sender: true, body: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        // A staff member claiming or answering a request must not let it leap
        // over a customer who has been waiting longer. Queue ordering is by
        // the last thing the customer did, then breaks ties by all activity.
        orderBy: [
          { lastCustomerActivityAt: 'desc' },
          { lastActivityAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return {
      items: items.map((ticket) => ({
        ...this.ticketSummary(ticket),
        customer: ticket.customer,
        latestMessage: ticket.messages[0] ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getForStaff(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        ...ticketInclude,
        customer: { select: { id: true, email: true, createdAt: true } },
        messages: {
          include: { author: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        events: {
          include: { actor: { select: { id: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Support request not found');
    return { ...this.ticketSummary(ticket), customer: ticket.customer, messages: ticket.messages, events: ticket.events };
  }

  /** Conditional update is the claim lock: two staff clicks cannot both win. */
  async claim(staff: AuthUser, id: string) {
    const now = new Date();
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.supportTicket.updateMany({
        where: {
          id,
          status: SupportTicketStatus.open,
          assigneeId: null,
        },
        data: {
          status: SupportTicketStatus.in_progress,
          assigneeId: staff.id,
          lastActivityAt: now,
        },
      });
      if (result.count === 0) return false;
      await tx.supportTicketEvent.create({
        data: { ticketId: id, actorId: staff.id, kind: SupportTicketEventKind.claimed },
      });
      await writeAudit(tx, {
        actor: { id: staff.id, email: staff.email },
        action: 'admin.support.claim',
        entityType: 'SupportTicket',
        entityId: id,
        before: { status: 'open', assigneeId: null },
        after: { status: 'in_progress', assigneeId: staff.id },
      });
      return true;
    });
    if (!changed) {
      const exists = await this.prisma.supportTicket.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Support request not found');
      throw new ConflictException('This request was already claimed or resolved');
    }
    const ticket = await this.getForStaff(id);
    await this.notify(ticket.customer.id, 'support_status', 'Support is reviewing your request', 'A support agent has started reviewing your request.', { supportTicketId: id, status: 'in_progress' });
    return ticket;
  }

  async unclaim(staff: AuthUser, id: string) {
    const changed = await this.prisma.$transaction(async (tx) => {
      const result = await tx.supportTicket.updateMany({
        where: {
          id,
          status: SupportTicketStatus.in_progress,
          assigneeId: staff.id,
        },
        data: { status: SupportTicketStatus.open, assigneeId: null },
      });
      if (result.count === 0) return false;
      await tx.supportTicketEvent.create({
        data: { ticketId: id, actorId: staff.id, kind: SupportTicketEventKind.unclaimed },
      });
      await writeAudit(tx, {
        actor: { id: staff.id, email: staff.email },
        action: 'admin.support.unclaim',
        entityType: 'SupportTicket',
        entityId: id,
        before: { status: 'in_progress', assigneeId: staff.id },
        after: { status: 'open', assigneeId: null },
      });
      return true;
    });
    if (!changed) throw new ForbiddenException('Only the agent assigned to this request can release it');
    return this.getForStaff(id);
  }

  async replyAsStaff(staff: AuthUser, id: string, rawBody: string) {
    const ticket = await this.requireAssigned(staff, id);
    const body = rawBody.trim();
    if (!body) throw new BadRequestException('Message cannot be blank');
    await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: { ticketId: id, authorId: staff.id, sender: SupportMessageSender.staff, body },
      });
      await tx.supportTicket.update({ where: { id }, data: { lastActivityAt: new Date() } });
      await writeAudit(tx, {
        actor: { id: staff.id, email: staff.email },
        action: 'admin.support.reply',
        entityType: 'SupportTicket',
        entityId: id,
        after: { staffResponse: true },
      });
    });
    await this.notify(ticket.customerId, 'support_reply', 'New support reply', 'A support agent replied to your request.', { supportTicketId: id });
    return this.getForStaff(id);
  }

  async resolve(staff: AuthUser, id: string, rawBody: string) {
    const ticket = await this.requireAssigned(staff, id);
    const body = rawBody.trim();
    if (!body) throw new BadRequestException('Send a final reply before resolving this request');
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.supportMessage.create({
        data: { ticketId: id, authorId: staff.id, sender: SupportMessageSender.staff, body },
      });
      await tx.supportTicket.update({
        where: { id },
        data: { status: SupportTicketStatus.resolved, resolvedAt: now, lastActivityAt: now },
      });
      await tx.supportTicketEvent.create({
        data: { ticketId: id, actorId: staff.id, kind: SupportTicketEventKind.resolved },
      });
      await writeAudit(tx, {
        actor: { id: staff.id, email: staff.email },
        action: 'admin.support.resolve',
        entityType: 'SupportTicket',
        entityId: id,
        before: { status: 'in_progress', assigneeId: staff.id },
        after: { status: 'resolved', assigneeId: staff.id },
      });
    });
    // One notification communicates the final reply and its status together,
    // instead of asking the customer to dismiss two notifications for one act.
    await this.notify(ticket.customerId, 'support_status', 'Support request resolved', 'Support has sent a final reply. Reply in the app if you still need help.', { supportTicketId: id, status: 'resolved' });
    return this.getForStaff(id);
  }

  async manageHelp() {
    return this.prisma.supportCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        faqs: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            createdBy: { select: { id: true, email: true } },
            publishedBy: { select: { id: true, email: true } },
          },
        },
      },
    });
  }

  async createCategory(staff: AuthUser, input: CreateSupportCategoryDto) {
    const name = input.name.trim();
    const description = input.description.trim();
    const slug = toSlug(name);
    if (!slug || !description) throw new BadRequestException('Category name and description cannot be blank');
    const existing = await this.prisma.supportCategory.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new ConflictException('A category with this name already exists');
    const created = await this.prisma.supportCategory.create({
      data: { name, description, slug, sortOrder: input.sortOrder ?? 0 },
    });
    await this.auditStaffChange(staff, 'admin.support_category.create', created.id, null, { name: created.name, active: true });
    return created;
  }

  async updateCategory(staff: AuthUser, id: string, input: UpdateSupportCategoryDto) {
    if (!hasValues(input)) throw new BadRequestException('Provide a category change');
    const current = await this.prisma.supportCategory.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Help category not found');
    const name = input.name?.trim();
    const description = input.description?.trim();
    const slug = name ? toSlug(name) : undefined;
    if (name && !slug) throw new BadRequestException('Category name must contain letters or numbers');
    if (slug && slug !== current.slug) {
      const duplicate = await this.prisma.supportCategory.findUnique({ where: { slug }, select: { id: true } });
      if (duplicate) throw new ConflictException('A category with this name already exists');
    }
    const updated = await this.prisma.supportCategory.update({
      where: { id },
      data: {
        name,
        description,
        slug,
        sortOrder: input.sortOrder,
        active: input.active,
      },
    });
    await this.auditStaffChange(staff, 'admin.support_category.update', id, categoryAudit(current), categoryAudit(updated));
    return updated;
  }

  async createFaq(staff: AuthUser, input: CreateSupportFaqDto) {
    await this.requireCategory(input.categoryId);
    const question = input.question.trim();
    const answer = input.answer.trim();
    if (!question || !answer) throw new BadRequestException('Question and answer cannot be blank');
    const faq = await this.prisma.supportFaq.create({
      data: {
        categoryId: input.categoryId,
        question,
        answer,
        sortOrder: input.sortOrder ?? 0,
        status: SupportFaqStatus.draft,
        createdById: staff.id,
      },
    });
    await this.auditStaffChange(staff, 'admin.support_faq.draft_create', faq.id, null, faqAudit(faq));
    return faq;
  }

  async updateDraft(staff: AuthUser, id: string, input: UpdateSupportFaqDto) {
    const current = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('FAQ not found');
    if (current.status !== SupportFaqStatus.draft) throw new BadRequestException('Published FAQs must be edited by an administrator');
    return this.updateFaqRecord(staff, current, input, 'admin.support_faq.draft_update');
  }

  async updateFaq(staff: AuthUser, id: string, input: UpdateSupportFaqDto) {
    const current = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('FAQ not found');
    return this.updateFaqRecord(staff, current, input, 'admin.support_faq.update');
  }

  async publishFaq(staff: AuthUser, id: string) {
    const current = await this.prisma.supportFaq.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('FAQ not found');
    await this.requireCategory(current.categoryId);
    const published = await this.prisma.supportFaq.update({
      where: { id },
      data: { status: SupportFaqStatus.published, publishedById: staff.id, publishedAt: new Date() },
    });
    await this.auditStaffChange(staff, 'admin.support_faq.publish', id, faqAudit(current), faqAudit(published));
    return published;
  }

  private async updateFaqRecord(
    staff: AuthUser,
    current: { id: string; categoryId: string; question: string; answer: string; sortOrder: number; status: SupportFaqStatus },
    input: UpdateSupportFaqDto,
    action: string,
  ) {
    if (!hasValues(input)) throw new BadRequestException('Provide an FAQ change');
    if (input.categoryId) await this.requireCategory(input.categoryId);
    const question = input.question?.trim();
    const answer = input.answer?.trim();
    if ((input.question !== undefined && !question) || (input.answer !== undefined && !answer)) {
      throw new BadRequestException('Question and answer cannot be blank');
    }
    const updated = await this.prisma.supportFaq.update({
      where: { id: current.id },
      data: {
        categoryId: input.categoryId,
        question,
        answer,
        sortOrder: input.sortOrder,
        status: input.status,
      },
    });
    await this.auditStaffChange(staff, action, current.id, faqAudit(current), faqAudit(updated));
    return updated;
  }

  private async requireAssigned(staff: AuthUser, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, customerId: true, status: true, assigneeId: true },
    });
    if (!ticket) throw new NotFoundException('Support request not found');
    if (ticket.status !== SupportTicketStatus.in_progress || ticket.assigneeId !== staff.id) {
      throw new ForbiddenException('Claim this request before replying or resolving it');
    }
    return ticket;
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.supportCategory.findUnique({ where: { id }, select: { id: true } });
    if (!category) throw new NotFoundException('Help category not found');
    return category;
  }

  private ticketSummary(ticket: {
    id: string;
    subject: string;
    status: SupportTicketStatus;
    lastActivityAt: Date;
    lastCustomerActivityAt: Date;
    resolvedAt: Date | null;
    createdAt: Date;
    category: { id: string; name: string; description: string };
    transfer: unknown;
    assignee: { id: string; email: string } | null;
  }) {
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      lastActivityAt: ticket.lastActivityAt,
      lastCustomerActivityAt: ticket.lastCustomerActivityAt,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      category: ticket.category,
      transfer: ticket.transfer,
      assignee: ticket.assignee,
    };
  }

  private async notify(
    userId: string,
    type: string,
    title: string,
    body: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.notifications.create(userId, type, title, body, metadata);
    } catch {
      // A support action and its audit trail are already committed. Notification
      // delivery should never make a staff reply disappear or tempt an agent to
      // resend it, which would duplicate the customer-visible message.
    }
  }

  private auditStaffChange(
    staff: AuthUser,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    return writeAudit(this.prisma, {
      actor: { id: staff.id, email: staff.email },
      action,
      entityType: action.includes('category') ? 'SupportCategory' : 'SupportFaq',
      entityId,
      before,
      after,
    });
  }
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hasValues(value: object) {
  return Object.values(value).some((entry) => entry !== undefined);
}

function categoryAudit(category: { name: string; description: string; sortOrder: number; active: boolean }) {
  return { name: category.name, description: category.description, sortOrder: category.sortOrder, active: category.active };
}

function faqAudit(faq: { categoryId: string; question: string; sortOrder: number; status: SupportFaqStatus }) {
  // FAQ content is in its own versioned record. The audit tells us which
  // guidance changed without duplicating text (and possible pasted data) into
  // a second retention surface.
  return { categoryId: faq.categoryId, question: faq.question, sortOrder: faq.sortOrder, status: faq.status };
}
