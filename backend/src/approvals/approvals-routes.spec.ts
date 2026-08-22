import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_KEY } from '../auth/guards/permissions.guard';
import { ApprovalsController } from './approvals.controller';
import { permissionsFor } from '../auth/permissions';

/**
 * The four-eyes routes, against the real graph.
 *
 * The permission assertions are the point. This feature is only a control
 * while `approval.decide` is held by someone who does not hold
 * `approval.request` for the same work — if a later edit put `approval.decide`
 * on the deciding *and* requesting side of one role, four-eyes would still
 * appear to function and would be checking nothing. That is asserted here
 * against the role map itself, not just against the decorators.
 */
describe('approval routes', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $on: jest.fn(),
        user: {},
        corridor: { findMany: jest.fn().mockResolvedValue([]) },
        ledgerAccount: { upsert: jest.fn() },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['get', '/admin/approvals'],
    ['post', '/admin/approvals'],
    ['post', '/admin/approvals/00000000-0000-0000-0000-000000000000/approve'],
    ['post', '/admin/approvals/00000000-0000-0000-0000-000000000000/reject'],
  ])(
    '%s %s is mounted and refuses an unauthenticated caller',
    async (method, path) => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const res = await (method === 'get'
        ? request(server).get(path)
        : request(server).post(path).send({}));
      expect(res.status).toBe(401);
    },
  );

  it('separates asking from deciding', () => {
    const reflector = app.get(Reflector);
    const permissionOf = (name: keyof ApprovalsController) =>
      reflector.get<string>(
        PERMISSION_KEY,
        ApprovalsController.prototype[name],
      );

    expect(permissionOf('create')).toBe('approval.request');
    expect(permissionOf('approve')).toBe('approval.decide');
    expect(permissionOf('reject')).toBe('approval.decide');
    // Reading is deliberately the weaker permission: the person who asked
    // should be able to see what happened to their request.
    expect(permissionOf('list')).toBe('approval.request');
  });

  it('gives operations the ability to ask and not to decide', () => {
    const ops = permissionsFor('operations');
    expect(ops).toContain('approval.request');
    // The whole feature. If this ever passes, four-eyes is theatre.
    expect(ops).not.toContain('approval.decide');
    // And they must not simply hold the gated action outright.
    expect(ops).not.toContain('transfer.force_fail');
  });

  it('gives compliance the ability to decide', () => {
    expect(permissionsFor('compliance')).toContain('approval.decide');
  });
});
