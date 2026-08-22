import { ConfigService } from '@nestjs/config';
import { TransfersScheduler } from './transfers.scheduler';
import type { TransfersService } from './transfers.service';

/**
 * The tick, now that it is concurrent.
 *
 * It used to await each transfer before starting the next, which capped the
 * whole product at roughly two transfers a second. Making it concurrent buys
 * throughput and brings two risks worth pinning down: that a batch might
 * silently exceed the pool limit and starve HTTP requests of database
 * connections, and that one transfer throwing might abandon the rest of the
 * batch — which the old sequential loop guarded against by catching inside the
 * loop, a detail easily lost in a rewrite.
 */

function makeScheduler(overrides: {
  due: string[];
  advance: jest.Mock;
  batch?: number;
  concurrency?: number;
}) {
  const findDueForTick = jest
    .fn()
    .mockResolvedValue(overrides.due.map((id) => ({ id })));
  const transfers = {
    findDueForTick,
    advance: overrides.advance,
  } as unknown as TransfersService;

  const values: Record<string, number> = {
    TRANSFER_TICK_MS: 5000,
    TRANSFER_TICK_BATCH: overrides.batch ?? 200,
    TRANSFER_TICK_CONCURRENCY: overrides.concurrency ?? 4,
  };
  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;

  const scheduler = new TransfersScheduler(transfers, config);
  // onModuleInit deliberately returns early under NODE_ENV=test so no real
  // timer is ever started; the settings it would have read are applied here.
  Object.assign(scheduler, {
    tickMs: values.TRANSFER_TICK_MS,
    batchSize: values.TRANSFER_TICK_BATCH,
    concurrency: values.TRANSFER_TICK_CONCURRENCY,
  });
  // The mocks are returned directly rather than read back off `transfers`:
  // reaching through the service type to assert on a method trips the
  // unbound-method rule, and the reference here is the same object anyway.
  return { scheduler, findDueForTick };
}

/** `tick` is private; the test drives it the way the timer would. */
function runTick(scheduler: TransfersScheduler): Promise<void> {
  return (scheduler as unknown as { tick(): Promise<void> }).tick();
}

describe('TransfersScheduler', () => {
  it('advances every transfer in the batch', async () => {
    const advance = jest.fn().mockResolvedValue(undefined);
    const due = Array.from({ length: 25 }, (_, i) => `t-${i}`);
    const { scheduler } = makeScheduler({ due, advance });

    await runTick(scheduler);

    expect(advance).toHaveBeenCalledTimes(25);
    const ids = (advance.mock.calls as string[][]).map((c) => c[0]);
    expect(new Set(ids).size).toBe(25);
  });

  it('never runs more than the configured number at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const advance = jest.fn().mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
    });
    const { scheduler } = makeScheduler({
      due: Array.from({ length: 50 }, (_, i) => `t-${i}`),
      advance,
      concurrency: 4,
    });

    await runTick(scheduler);

    // The ceiling that keeps background work from consuming the Prisma pool
    // and making the API queue behind it.
    expect(peak).toBeLessThanOrEqual(4);
    // And it does use the pool it is given, rather than serialising anyway.
    expect(peak).toBeGreaterThan(1);
  });

  it('finishes the batch when one transfer throws', async () => {
    const advance = jest.fn().mockImplementation((id: string) => {
      if (id === 't-3') return Promise.reject(new Error('provider timeout'));
      return Promise.resolve();
    });
    const { scheduler } = makeScheduler({
      due: Array.from({ length: 10 }, (_, i) => `t-${i}`),
      advance,
      concurrency: 3,
    });

    // The tick itself must not reject either — an unhandled rejection out of a
    // setInterval callback takes the process down.
    await expect(runTick(scheduler)).resolves.toBeUndefined();
    expect(advance).toHaveBeenCalledTimes(10);
  });

  it('does not start a second tick while one is still running', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const advance = jest.fn().mockImplementation(() => gate);
    const { scheduler, findDueForTick } = makeScheduler({
      due: ['t-1'],
      advance,
    });

    const first = runTick(scheduler);
    await runTick(scheduler); // overlapping call: should return immediately
    release();
    await first;

    // A slow tick must not stack up behind itself — that is how a scheduler
    // turns a transient database slowdown into an outage.
    expect(findDueForTick).toHaveBeenCalledTimes(1);
  });

  it('asks for no more than the configured batch size', async () => {
    const { scheduler, findDueForTick } = makeScheduler({
      due: [],
      advance: jest.fn(),
      batch: 75,
    });

    await runTick(scheduler);

    expect(findDueForTick).toHaveBeenCalledWith(5000, 75);
  });
});
