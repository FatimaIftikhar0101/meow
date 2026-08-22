import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from './wallet.service';

/**
 * The wallet a real customer did not have.
 *
 * Signing in with Google against an address that already has an account links
 * the two and creates nothing — right for a customer who already has a wallet,
 * wrong for an account created any other way. Someone hit that on a physical
 * phone and was shown "Wallet not found" when they tried to add money: a true
 * statement about our data and no help whatsoever.
 *
 * There is no case where refusing is the right answer. A wallet is an empty
 * ledger account; making one is free, and the upsert makes it safe to race.
 */
describe('wallet bootstrap', () => {
  let service: WalletService;
  let prisma: {
    ledgerAccount: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let ensure: jest.Mock;

  beforeEach(async () => {
    prisma = {
      ledgerAccount: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    ensure = jest.fn().mockResolvedValue({
      id: 'w-new',
      currency: 'CAD',
      kind: 'customer_wallet',
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: LedgerService,
          useValue: {
            ensureCustomerAccount: ensure,
            balance: jest.fn().mockResolvedValue(new Prisma.Decimal(0)),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(WalletService);
  });

  it('uses the existing wallet when there is one', async () => {
    prisma.ledgerAccount.findFirst.mockResolvedValue({
      id: 'w-1',
      currency: 'CAD',
    });
    const result = await service.getBalance('u-1');
    expect(result.currency).toBe('CAD');
    expect(ensure).not.toHaveBeenCalled();
  });

  it('creates one rather than reporting "Wallet not found"', async () => {
    prisma.ledgerAccount.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', country: 'CA' });

    await expect(service.getBalance('u-1')).resolves.toEqual({
      balance: '0.00',
      currency: 'CAD',
    });
    expect(ensure).toHaveBeenCalledWith('u-1', 'CAD');
  });

  it('picks the currency from the country on the account', async () => {
    prisma.ledgerAccount.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', country: 'PK' });
    await service.getBalance('u-1');
    expect(ensure).toHaveBeenCalledWith('u-1', 'PKR');
  });

  it('falls back to CAD when the account has no country', async () => {
    // Exactly the Google case: that path stores no country at all.
    prisma.ledgerAccount.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', country: null });
    await service.getBalance('u-1');
    expect(ensure).toHaveBeenCalledWith('u-1', 'CAD');
  });

  it('still refuses a user that does not exist', async () => {
    prisma.ledgerAccount.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getBalance('ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ensure).not.toHaveBeenCalled();
  });
});

describe('LedgerService.homeCurrencyFor', () => {
  it('is one implementation, shared by every path that needs it', () => {
    // Registration, Google sign-up and on-demand creation all decide a home
    // currency. Two of the three agreeing is not good enough.
    expect(LedgerService.homeCurrencyFor('CA')).toBe('CAD');
    expect(LedgerService.homeCurrencyFor('pakistan')).toBe('PKR');
    expect(LedgerService.homeCurrencyFor('UK')).toBe('GBP');
    expect(LedgerService.homeCurrencyFor(null)).toBe('CAD');
    expect(LedgerService.homeCurrencyFor(undefined)).toBe('CAD');
  });
});
