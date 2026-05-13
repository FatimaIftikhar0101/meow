import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransfersService } from './transfers.service';

@Injectable()
export class TransfersScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransfersScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tickMs = 5000;

  constructor(
    private readonly transfers: TransfersService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.tickMs = this.config.get<number>('TRANSFER_TICK_MS') ?? 5000;
    this.timer = setInterval(() => void this.tick(), this.tickMs);
    this.logger.log(`Scheduler started, tick=${this.tickMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.transfers.findDueForTick(this.tickMs);
      for (const t of due) {
        try {
          await this.transfers.advance(t.id);
        } catch (err) {
          this.logger.error(
            `Failed to advance ${t.id}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
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
}
