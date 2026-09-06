import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransfersService } from './transfers.service';

/**
 * Drives transfers through their statuses.
 *
 * This is the mock provider: it stands in for the payout partner's callbacks
 * until real licences and APIs arrive, at which point the advancing itself is
 * replaced. The *shape* — claim a batch of work, do it with bounded
 * concurrency, never let background work starve the API — outlives that
 * replacement, which is why it is worth getting right now.
 *
 * ── [LICENSED-INTEGRATION] Payout partner ────────────────────────────────────
 *
 * This is where money actually leaves the business, and today nothing does: a
 * timer moves a row through `sent -> in_transit -> delivered` on its own. Under
 * a licence the tick stops driving transfers at all. It is replaced by
 *
 *   1. an outbound call to the partner when a transfer reaches `sent`, taking
 *      the beneficiary details and returning the partner's own reference, and
 *   2. a signed webhook from the partner that calls `advance()` when *they*
 *      settle it.
 *
 * `advance()` and its compare-and-set on the current status stay exactly as
 * they are — that is what makes a webhook safe to receive twice, which every
 * partner will do. What must be added alongside the webhook route is signature
 * verification, replay rejection, and a stored partner reference on Transfer so
 * a payout can be reconciled against their statement.
 *
 * The timer does not disappear entirely. It becomes the reaper for transfers
 * the partner never called back about, which is what `?aging=true` in the back
 * office already surfaces.
 *
 * Candidates for Canada -> PK/IN: Wise Platform, Thunes, Nium, Terrapay. All of
 * them require the licence below before they will issue production credentials.
 *
 * ── The ceiling this used to have ────────────────────────────────────────────
 *
 * The batch was hardcoded at 50 and processed strictly one at a time, awaiting
 * each transfer before starting the next. Fifty transitions per five-second
 * tick is ten a second, and a transfer needs five transitions to go from
 * initiated to delivered — so the whole product was capped at roughly **two
 * transfers per second**, globally, with no way to raise it and nothing
 * anywhere reporting that a cap was being hit.
 *
 * Now the batch is configurable and worked by a small pool. Concurrency is
 * deliberately modest: `DATABASE_URL` sets `connection_limit=10`, and
 * background work that consumes the pool makes HTTP requests queue behind it.
 * A slow scheduler is a much better failure than an API that times out, so the
 * default leaves most of the pool for requests.
 *
 * ── Running more than one instance ───────────────────────────────────────────
 *
 * Every replica runs its own timer and will scan the same rows. That is safe
 * but wasteful: `advance()` transitions with a compare-and-set on the current
 * status, so exactly one replica's write lands and the rest find the status
 * changed and stop. What it costs is duplicated reads. The fix is a job queue
 * with claimed work rather than a polling scan — backlog #41 — and it wants
 * doing at the same time as the provider integration, not before it.
 */
@Injectable()
export class TransfersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransfersScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tickMs = 5000;
  private batchSize = 200;
  private concurrency = 4;
  /** Suppresses a repeated warning when the backlog stays over capacity. */
  private warnedSaturated = false;

  constructor(
    private readonly transfers: TransfersService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.tickMs = this.config.get<number>('TRANSFER_TICK_MS') ?? 5000;
    this.batchSize = this.config.get<number>('TRANSFER_TICK_BATCH') ?? 200;
    this.concurrency =
      this.config.get<number>('TRANSFER_TICK_CONCURRENCY') ?? 4;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.logger.log(
      `Scheduler started, tick=${this.tickMs}ms batch=${this.batchSize} concurrency=${this.concurrency}`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    try {
      const due = await this.transfers.findDueForTick(
        this.tickMs,
        this.batchSize,
      );
      if (!due.length) {
        this.warnedSaturated = false;
        return;
      }

      await this.runPool(due, this.concurrency, async (t) => {
        try {
          await this.transfers.advance(t.id);
        } catch (err) {
          // One transfer failing must not abandon the rest of the batch.
          this.logger.error(
            `Failed to advance ${t.id}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      });

      // A full batch means there was more work than one tick could take, so
      // the backlog is growing. Said once per episode rather than every tick:
      // this is the signal that the batch size or the tick interval needs
      // changing, and it used to be entirely invisible.
      if (due.length >= this.batchSize && !this.warnedSaturated) {
        this.warnedSaturated = true;
        this.logger.warn(
          `Tick filled its batch of ${this.batchSize}; transfers are arriving ` +
            'faster than they are being advanced. Raise TRANSFER_TICK_BATCH or ' +
            'TRANSFER_TICK_CONCURRENCY, or move to a job queue.',
        );
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed > this.tickMs) {
        this.logger.warn(
          `Tick took ${elapsed}ms, longer than the ${this.tickMs}ms interval — ` +
            'ticks are being skipped.',
        );
      }
    } catch (err) {
      this.logger.error(
        'Tick failed',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Run `fn` over every item, at most `limit` at a time.
   *
   * A fixed set of workers pulling from a shared cursor, rather than chunking
   * into slices of `limit` and awaiting each slice. Chunking is the more
   * obvious shape and it idles: every chunk runs at the speed of its slowest
   * member while the rest of the workers sit finished and unused.
   *
   * `cursor++` needs no lock — this is one event loop, and the increment
   * completes before any await can yield.
   */
  private async runPool<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const worker = async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        await fn(items[index]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, worker),
    );
  }
}
