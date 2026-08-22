import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  PermissionsGuard,
  RequirePermission,
} from '../auth/guards/permissions.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LedgerExplorerService } from './ledger-explorer.service';
import { ListPostingsDto } from './dto/list-postings.dto';

/**
 * The books, readable.
 *
 * `ledger.read` has been in the permission map since RBAC landed and nothing
 * consumed it: the ledger was reachable only through one transfer at a time.
 * That answers "what happened to this payment" and cannot answer "what do we
 * hold", "what is in flight", or "what have we earned" — which are the
 * questions somebody asks before signing anything.
 *
 * Read-only, and not by omission. A ledger with a write endpoint is not a
 * ledger; corrections are reversing entries posted by the operation that got
 * it wrong, never an edit here.
 */
@Controller('admin/ledger')
@UseGuards(JwtAuthGuard, StaffGuard, PermissionsGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerExplorerService) {}

  /** The chart of accounts with a balance against each. */
  @Get('accounts')
  @RequirePermission('ledger.read')
  accounts(@Query('currency') currency?: string) {
    return this.ledger.accounts(currency);
  }

  /**
   * The trial balance: every account grouped by currency, with the sum.
   *
   * In a working double-entry system that sum is zero for every currency. It
   * being anything else is the single most useful number in the panel, because
   * it means money has been recorded as coming from nowhere.
   */
  @Get('trial-balance')
  @RequirePermission('ledger.read')
  trialBalance() {
    return this.ledger.trialBalance();
  }

  /** Postings, newest first, with both legs of each. */
  @Get('postings')
  @RequirePermission('ledger.read')
  postings(@Query() query: ListPostingsDto) {
    return this.ledger.postings(query);
  }
}
