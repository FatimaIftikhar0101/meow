import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationsGateway,
  type NotificationPayload,
} from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async create(
    userId: string,
    type: string,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
    const payload: NotificationPayload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata as Record<string, unknown> | null,
      createdAt: notification.createdAt.toISOString(),
    };
    this.gateway.push(userId, payload);
    return notification;
  }

  async list(userId: string, limit = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
