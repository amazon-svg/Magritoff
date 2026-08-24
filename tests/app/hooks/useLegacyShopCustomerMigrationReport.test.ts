import { describe, expect, it } from 'vitest';
import type { LegacyShopCustomerMigrationReportRow } from '../../../src/modules/shop-customers';
import { summarizeLegacyMigration } from '../../../src/modules/shop-customers/ui';

const row = (
  migrationOutcome: LegacyShopCustomerMigrationReportRow['migrationOutcome'],
  ordersLinkedCount: number,
): LegacyShopCustomerMigrationReportRow => ({
  legacyUserId: crypto.randomUUID(),
  shopId: crypto.randomUUID(),
  normalizedEmail: 'client@example.com',
  proposedAction: migrationOutcome?.startsWith('skipped_') ? migrationOutcome : 'matched_existing',
  targetAccountId: null,
  migrationOutcome,
  ordersLinkedCount,
  lastAttemptAt: null,
});

describe('summarizeLegacyMigration', () => {
  it('compte les rattachements en attente, ignorés et les commandes reliées', () => {
    expect(summarizeLegacyMigration([
      row(null, 0),
      row('created', 3),
      row('matched_existing', 2),
      row('skipped_invalid_email', 0),
    ])).toEqual({ pending: 1, skipped: 1, ordersLinked: 5 });
  });

  it('retourne une synthèse vide pour un rapport vide', () => {
    expect(summarizeLegacyMigration([])).toEqual({ pending: 0, skipped: 0, ordersLinked: 0 });
  });
});
