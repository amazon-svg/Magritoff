/**
 * Tests helpers MockupImage (S-PRODUCT-VIEWS-MULTI extension).
 *
 * Valide :
 *  - buildPublicMockupUrl : path sans suffixe pour front, __back pour back
 *  - buildEdgeFunctionUrl : query param view=back ajouté quand applicable
 *  - retro-compat front absence de view (path inchangé)
 */

import { describe, expect, it } from 'vitest';
import {
  buildEdgeFunctionUrl,
  buildPublicMockupUrl,
  type MockupSpecs,
} from '../../src/app/components/mockup/MockupImage.helpers';

const baseParams = {
  tenantId: 'tenant-uuid',
  shopId: 'shop-uuid',
  productId: 'product-uuid',
};

const baseSpecs: MockupSpecs = {
  ...baseParams,
  width: 148,
  height: 210,
  productName: 'Flyer A5',
  primaryColor: '#1e3a8a',
  template: 'flyer',
};

describe('buildPublicMockupUrl (S-PRODUCT-VIEWS-MULTI + P3-VISUELS cache _v2)', () => {
  it('front (default) : path avec suffixe cache version _v2', () => {
    const url = buildPublicMockupUrl('myproject', baseParams);
    // P3-VISUELS (2026-06-15) : suffix _v2 ajouté pour invalider le cache PNG
    // post-refonte des templates SVG Magrit-brandés.
    expect(url).toBe(
      'https://myproject.supabase.co/storage/v1/object/public/product_mockups/tenant-uuid/shop-uuid/product-uuid_v5.png',
    );
  });

  it('view=front explicite : identique au default avec _v2', () => {
    const url = buildPublicMockupUrl('myproject', { ...baseParams, view: 'front' });
    expect(url).toContain('product-uuid_v5.png');
    expect(url).not.toContain('__back');
  });

  it('view=back : path suffixé __back_v5.png (back avant version)', () => {
    const url = buildPublicMockupUrl('myproject', { ...baseParams, view: 'back' });
    expect(url).toContain('product-uuid__back_v5.png');
  });
});

describe('buildEdgeFunctionUrl (S-PRODUCT-VIEWS-MULTI)', () => {
  it('front (default) : pas de query view= (retro-compat)', () => {
    const url = buildEdgeFunctionUrl('myproject', baseSpecs);
    expect(url).not.toContain('view=');
  });

  it('view=front : pas de query view= (retro-compat, edge default front)', () => {
    const url = buildEdgeFunctionUrl('myproject', { ...baseSpecs, view: 'front' });
    expect(url).not.toContain('view=');
  });

  it('view=back : query view=back ajouté', () => {
    const url = buildEdgeFunctionUrl('myproject', { ...baseSpecs, view: 'back' });
    expect(url).toContain('view=back');
  });

  it('view=back préserve les autres params (template, productName, ...)', () => {
    const url = buildEdgeFunctionUrl('myproject', { ...baseSpecs, view: 'back' });
    expect(url).toContain('template=flyer');
    expect(url).toContain('width=148');
    expect(url).toContain('view=back');
  });
});
