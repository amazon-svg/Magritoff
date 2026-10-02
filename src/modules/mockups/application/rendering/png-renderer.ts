import { Resvg } from '@resvg/resvg-js';
import { brochureSvg } from './templates/brochure.ts';
import { carteVisiteSvg } from './templates/carteVisite.ts';
import { depliantSvg } from './templates/depliant.ts';
import { etiquetteSvg } from './templates/etiquette.ts';
import { flyerSvg } from './templates/flyer.ts';
import { kakemonoSvg } from './templates/kakemono.ts';
import { packagingSvg } from './templates/packaging.ts';
import {
  MockupRendererError,
  type MockupTemplate,
  type ProductSpecs,
  type ShopTheming,
} from './types.ts';

export const SUPPORTED_MOCKUP_TEMPLATES: readonly MockupTemplate[] = Object.freeze([
  'flyer',
  'carteVisite',
  'brochure',
  'etiquette',
  'kakemono',
  'packaging',
  'depliant',
]);

export function isMockupTemplate(value: string): value is MockupTemplate {
  return (SUPPORTED_MOCKUP_TEMPLATES as readonly string[]).includes(value);
}

export function renderMockupPng(
  template: MockupTemplate,
  specs: ProductSpecs,
  theming: ShopTheming,
): Uint8Array {
  if (!Number.isFinite(specs.width) || specs.width <= 0
    || !Number.isFinite(specs.height) || specs.height <= 0
    || !specs.productName.trim() || !/^#[0-9a-f]{6}$/i.test(theming.primaryColor)) {
    throw new MockupRendererError('invalid_specs', 'Dimensions, nom du produit ou couleur invalides.');
  }
  const svg = renderSvg(template, specs, theming);
  try {
    const result = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1024 },
      font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
    }).render().asPng();
    return new Uint8Array(result);
  } catch (error) {
    throw new MockupRendererError('render_failed', 'Le rendu PNG du mockup a échoué.', error);
  }
}

function renderSvg(template: MockupTemplate, specs: ProductSpecs, theming: ShopTheming): string {
  switch (template) {
    case 'flyer': return flyerSvg(specs, theming);
    case 'carteVisite': return carteVisiteSvg(specs, theming);
    case 'brochure': return brochureSvg(specs, theming);
    case 'etiquette': return etiquetteSvg(specs, theming);
    case 'kakemono': return kakemonoSvg(specs, theming);
    case 'packaging': return packagingSvg(specs, theming);
    case 'depliant': return depliantSvg(specs, theming);
  }
}
