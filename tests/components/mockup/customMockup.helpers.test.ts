import { describe, expect, it } from 'vitest';
import { resolveCustomMockup } from '@/modules/mockups/ui/components/customMockup.helpers';

describe('resolveCustomMockup', () => {
  it('résout localement un override déjà autorisé par le catalogue', () => {
    const records = [{ shopId: '22222222-2222-4222-8222-222222222222', templateType: 'flyer' as const, view: 'front' as const, mockupImageUrl: 'https://assets.magrit.test/flyer.svg' }];
    expect(resolveCustomMockup(records, 'flyer', 'front')).toBe('https://assets.magrit.test/flyer.svg');
    expect(resolveCustomMockup(records, 'flyer', 'back')).toBeNull();
  });
});
