/**
 * Response shapes from the NestJS backend. Hand-written rather than generated,
 * and kept in the same order as the serialisers they mirror so the two can be
 * diffed by eye.
 *
 * Money is a `string` wherever the backend serialises a Prisma.Decimal — see
 * lib/money.ts for why that must not be parsed into a float. The one exception
 * is /corridors/convert, which returns numbers (it is a quote, not a balance).
 */

export type TransferStatus =
  | 'initiated'
  | 'payment_received'
  | 'compliance_check'
  | 'fx_converted'
  | 'payout_processing'
  | 'delivered'
  | 'failed'
  | 'cancelled';

/** Statuses the backend still allows a user to cancel — mirrors CANCELLABLE. */
export const CANCELLABLE_STATUSES: TransferStatus[] = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
];

export const TERMINAL_STATUSES: TransferStatus[] = ['delivered', 'failed', 'cancelled'];

export type KycStatus = 'pending' | 'passed' | 'failed';
export type UserRole = 'customer' | 'admin';

export interface Profile {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  country: string | null;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
}

export interface Balance {
  balance: string;
  currency: string;
}

export interface LedgerTransaction {
  id: string;
  direction: 'credit' | 'debit';
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  createdAt: string;
  transfer: { id: string; recipient: { name: string; country: string } } | null;
}

export interface Recipient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string;
  bankAccount: string;
  bankName: string | null;
  bankCode: string | null;
  createdAt: string;
  /**
   * Only present on POST /recipients, which returns the whole row. The list
   * endpoint already filters to `active: true` and omits the column, so nothing
   * should branch on this — an absent value does not mean inactive.
   */
  active?: boolean;
}

export interface Corridor {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  baseRate: string;
  marginBps: number;
  feeFlat: string;
  feePercentBps: number;
  minSendAmount: string;
  maxSendAmount: string;
  active: boolean;
}

/** /corridors/convert — numbers, not decimal strings. */
export interface Quote {
  from: string;
  to: string;
  sendAmount: number;
  receiveAmount: number;
  rate: number;
  fee: number;
  minSendAmount: number;
  maxSendAmount: number;
}

export interface TransferSummary {
  id: string;
  amount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  status: TransferStatus;
  createdAt: string;
  recipient: { name: string; country: string };
}

export interface TransferEvent {
  id: string;
  status: TransferStatus;
  message: string;
  createdAt: string;
}

export interface TransferDetail {
  id: string;
  amount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  fxRateApplied: string | null;
  feeAmount: string;
  status: TransferStatus;
  failureReason: string | null;
  createdAt: string;
  recipient: { name: string; country: string; bankAccount: string };
  timeline: TransferEvent[];
}

export interface ComplianceStatus {
  status: KycStatus;
  provider: string | null;
  verifiedAt: string | null;
  reason: string | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

/**
 * Mirrors AuthService.listSessions exactly. Note there is no `expiresAt` —
 * the column exists on the model but the serialiser does not expose it, so the
 * UI must not promise an expiry date it was never given.
 */
export interface SessionRow {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  createdAt: string;
}

/** ReferralsService.getDashboard. Note: no shareUrl — the client builds one. */
export interface ReferralDashboard {
  code: string;
  stats: {
    invited: number;
    rewarded: number;
    pending: number;
    totalEarned: string;
    currency: string;
  };
  referrals: {
    id: string;
    maskedEmail: string;
    status: 'pending' | 'qualified' | 'rewarded';
    createdAt: string;
    rewardedAt: string | null;
  }[];
}

/* ── Admin ─────────────────────────────────────────────────────────────── */

export interface AdminStats {
  users: number;
  transfers: number;
  inFlight: number;
  delivered: number;
  failed: number;
  totalDeliveredVolume: string;
}

/** Every admin list endpoint pages this way — `items`, not `data`. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  country: string | null;
  role: UserRole;
  suspended: boolean;
  createdAt: string;
  transferCount: number;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  country: string | null;
  role: UserRole;
  suspended: boolean;
  createdAt: string;
  wallets: { id: string; currency: string }[];
  balances: { currency: string; balance: string }[];
  transferCount: number;
  kycRecords: {
    id: string;
    status: KycStatus;
    provider: string | null;
    reason: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }[];
}

export interface AdminTransferRow {
  id: string;
  userEmail: string;
  recipient: { name: string; country: string };
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  status: TransferStatus;
  createdAt: string;
}

export interface AdminTransferDetail {
  id: string;
  user: { id: string; email: string; country: string | null };
  /**
   * The beneficiary as recorded when the transfer was made, not the saved
   * recipient as it stands now — editing a recipient does not rewrite history.
   *
   * The account number is masked: staff get the last four, and a full reveal
   * belongs behind an explicit audited action in the back-office panel.
   */
  recipient: {
    name: string;
    country: string;
    bankAccountMasked: string;
    bankName: string | null;
    bankCode: string | null;
  };
  /** The saved recipient today, so a divergence from the snapshot is visible
   *  rather than something staff have to guess at. */
  savedRecipient: (Omit<Recipient, 'bankAccount'> & {
    bankAccountMasked: string;
  }) | null;
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  fxRateApplied: string | null;
  feeAmount: string;
  status: TransferStatus;
  failureReason: string | null;
  providerName: string | null;
  providerRef: string | null;
  createdAt: string;
  timeline: TransferEvent[];
  ledgerEntries: {
    id: string;
    direction: 'credit' | 'debit';
    type: string;
    amount: string;
    currency: string;
    createdAt: string;
  }[];
}

export interface AuditRow {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
