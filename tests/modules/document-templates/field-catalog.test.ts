/**
 * E10.10b-4b — catalogue de champs FR
 * (`src/modules/document-templates/ui/workspace/field-editor/field-catalog.ts`).
 *
 * Garantit que la palette ne peut PAS oublier une valeur de l enum contrat
 * (`DocumentFieldId`/`DocumentLineFieldId`/`DocumentFont`) : un champ sans
 * libelle FR serait invisible dans l ecran sans qu aucun test ne le
 * signale — c est precisement ce que ce fichier empeche.
 */
import { describe, expect, it } from 'vitest';
import {
  documentFieldIdSchema,
  documentFontSchema,
  documentLineFieldIdSchema,
} from '@/modules/document-templates/api/contracts';
import {
  FIELD_CATALOG,
  FIELD_FAMILY_LABELS,
  FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE,
  fieldLabel,
  fontFromEnum,
  fontToEnum,
  FONT_STYLES_BY_FAMILY,
  LINE_FIELD_CATALOG,
  lineFieldLabel,
} from '@/modules/document-templates/ui/workspace/field-editor/field-catalog';

describe('FIELD_CATALOG', () => {
  it('couvre EXACTEMENT les valeurs de DocumentFieldId (30 depuis E10.19a, order.* inclus), sans doublon', () => {
    const catalogIds = FIELD_CATALOG.map((entry) => entry.id);
    const enumValues = documentFieldIdSchema.options;

    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    expect([...catalogIds].sort()).toEqual([...enumValues].sort());
  });

  it('chaque entree porte un libelle FR non vide, distinct de l identifiant technique', () => {
    for (const entry of FIELD_CATALOG) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(entry.label).not.toBe(entry.id);
    }
  });

  it('chaque famille du catalogue a un libelle de section', () => {
    for (const entry of FIELD_CATALOG) {
      expect(FIELD_FAMILY_LABELS[entry.family]).toBeTruthy();
    }
  });

  it('fieldLabel() rend le libelle catalogue, jamais l identifiant brut pour une valeur connue', () => {
    expect(fieldLabel('totals.total_incl_tax')).toBe('Total TTC');
  });
});

describe('E10.19a — famille `order`, sous-ensemble opposable par type', () => {
  it('porte EXACTEMENT les cinq valeurs order.* du contrat, sans order.status', () => {
    const orderEntries = FIELD_CATALOG.filter((entry) => entry.family === 'order').map((entry) => entry.id);
    expect([...orderEntries].sort()).toEqual(
      [
        'order.number',
        'order.created_at',
        'order.quote_number',
        'order.customer_reference',
        'order.expected_delivery_date',
      ].sort(),
    );
    expect(orderEntries).not.toContain('order.status');
  });

  it('FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE : quote et order NE MELANGENT JAMAIS leur famille de tete', () => {
    expect(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE.quote).toContain('quote');
    expect(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE.quote).not.toContain('order');
    expect(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE.order).toContain('order');
    expect(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE.order).not.toContain('quote');

    // Les trois familles communes valent pour les deux types (contrat §4).
    for (const common of ['customer', 'totals', 'page'] as const) {
      expect(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE.quote).toContain(common);
      expect(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE.order).toContain(common);
    }
  });

  it('chaque famille de FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE a un libelle de section', () => {
    for (const families of Object.values(FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE)) {
      for (const family of families) {
        expect(FIELD_FAMILY_LABELS[family]).toBeTruthy();
      }
    }
  });
});

describe('LINE_FIELD_CATALOG', () => {
  it('couvre EXACTEMENT les 7 valeurs de DocumentLineFieldId, sans doublon', () => {
    const catalogIds = LINE_FIELD_CATALOG.map((entry) => entry.id);
    const enumValues = documentLineFieldIdSchema.options;

    expect(new Set(catalogIds).size).toBe(catalogIds.length);
    expect([...catalogIds].sort()).toEqual([...enumValues].sort());
  });

  it('lineFieldLabel() rend le libelle catalogue', () => {
    expect(lineFieldLabel('line.price')).toBe('Prix');
  });
});

describe('DocumentFont — deux menus couples famille/style', () => {
  it('fontToEnum(fontFromEnum(x)) est l identite pour les 8 valeurs de DocumentFont', () => {
    for (const font of documentFontSchema.options) {
      const { family, style } = fontFromEnum(font);
      expect(fontToEnum(family, style)).toBe(font);
    }
  });

  it('"Chasse fixe" ne propose PAS de style Italique (absent du contrat)', () => {
    expect(FONT_STYLES_BY_FAMILY.mono).not.toContain('italic');
    expect(FONT_STYLES_BY_FAMILY.sans).toContain('italic');
    expect(FONT_STYLES_BY_FAMILY.serif).toContain('italic');
  });
});
