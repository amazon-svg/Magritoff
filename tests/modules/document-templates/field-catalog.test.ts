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
  fieldLabel,
  fontFromEnum,
  fontToEnum,
  FONT_STYLES_BY_FAMILY,
  LINE_FIELD_CATALOG,
  lineFieldLabel,
} from '@/modules/document-templates/ui/workspace/field-editor/field-catalog';

describe('FIELD_CATALOG', () => {
  it('couvre EXACTEMENT les 25 valeurs de DocumentFieldId, sans doublon', () => {
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
