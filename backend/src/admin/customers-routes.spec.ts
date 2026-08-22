import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PERMISSION_KEY } from '../auth/guards/permissions.guard';
import { Reflector } from '@nestjs/core';

/**
 * The customer-360 routes, checked against the real application graph.
 *
 * `customers.spec.ts` builds `CustomersService` by hand and proves what it
 * does. That says nothing about whether the controller is reachable, whether
 * Nest knows about it at all, or whether the permission decorators say what
 * the file intends — a controller left out of `AdminModule` passes every unit
 * test and 404s in production.
 *
 * The permission assertions matter more than they look. `customer.pii_full`
 * exists so that reading a full account number is compliance-only; if a future
 * edit relaxed that decorator to `customer.read`, nothing else in the suite
 * would notice, and every support agent would silently gain the ability to
 * unmask account numbers. That is precisely the kind of change that is invisible
 * in review and obvious in a breach report.
 */
describe('customer 360 routes', () => {
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

  it('registers the controller in the real module graph', () => {
    expect(app.get(CustomersController)).toBeInstanceOf(CustomersController);
    expect(app.get(CustomersService)).toBeInstanceOf(CustomersService);
  });

  describe.each([
    ['get', '/admin/customers/00000000-0000-0000-0000-000000000000'],
    ['post', '/admin/customers/00000000-0000-0000-0000-000000000000/reveal'],
    ['get', '/admin/customers/00000000-0000-0000-0000-000000000000/notes'],
    ['post', '/admin/customers/00000000-0000-0000-0000-000000000000/notes'],
  ])('%s %s', (method, path) => {
    it('exists and refuses an unauthenticated caller', async () => {
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const res = await (method === 'get'
        ? request(server).get(path)
        : request(server).post(path).send({}));

      // 401, not 404: the route is mounted, and the guard is what turned the
      // caller away. A 404 here would mean the controller never registered.
      expect(res.status).toBe(401);
    });
  });

  it('gates each route on the permission it is meant to need', () => {
    const reflector = app.get(Reflector);
    const permissionOf = (name: keyof CustomersController) =>
      reflector.get<string>(
        PERMISSION_KEY,
        CustomersController.prototype[name],
      );

    expect(permissionOf('overview')).toBe('customer.read');
    expect(permissionOf('listNotes')).toBe('customer.read');
    expect(permissionOf('addNote')).toBe('customer.note');
    // Compliance only. Support holds customer.read and must not be able to
    // unmask an account number with it.
    expect(permissionOf('reveal')).toBe('customer.pii_full');
  });
});
