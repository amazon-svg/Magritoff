import { describe, expect, it } from 'vitest';
import {
  activeGammeSlugs,
  gammeSubscriptionError,
} from '@/modules/catalog/ui/hooks/useTenantGammeSubscriptions';

describe('useTenantGammeSubscriptions helpers', () => {
  it('ne conserve que les souscriptions actives', () => {
    expect([...activeGammeSlugs([
      { gammeSlug: 'flyers', active: true },
      { gammeSlug: 'brochures', active: false },
    ])]).toEqual(['flyers']);
  });

  it('normalise les erreurs sans message', () => {
    expect(gammeSubscriptionError(new Error('Refusé'))).toBe('Refusé');
    expect(gammeSubscriptionError(null)).toBe('erreur réseau');
  });
});
