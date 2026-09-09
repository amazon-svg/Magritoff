/**
 * qa-review B5 (BLOQUANT, corrige) — `sanitizeForStandardPdfFont` /
 * `sanitizeFieldValues`. Prouve par execution reelle (voir
 * `quote-document-renderer.test.ts`, qui verifie que les valeurs assainies
 * s ecrivent bien sans lever) que le REPERTOIRE suppose ici correspond a ce
 * que `pdf-lib@1.17.1` accepte reellement en WinAnsi.
 */
import { describe, expect, it } from 'vitest';
import {
  sanitizeFieldValues,
  sanitizeForStandardPdfFont,
} from '@/modules/quote-documents/application/document-text-sanitization';

describe('sanitizeForStandardPdfFont', () => {
  it('ne touche JAMAIS aux caracteres francais usuels (deja WinAnsi, chemin rapide)', () => {
    expect(sanitizeForStandardPdfFont('café à côté œuf €')).toBe('café à côté œuf €');
    expect(sanitizeForStandardPdfFont('Établissements Dupont & Fils')).toBe('Établissements Dupont & Fils');
  });

  it('ne touche jamais aux symboles typographiques du bloc special Windows-1252 (0x80-0x9F)', () => {
    expect(sanitizeForStandardPdfFont('“guillemets” – tiret — ellipse… ™')).toBe('“guillemets” – tiret — ellipse… ™');
  });

  it("translittere les lettres 'a barre' sans decomposition Unicode (Ł/ł, Đ/đ)", () => {
    expect(sanitizeForStandardPdfFont('Łukasz Nowak')).toBe('Lukasz Nowak');
    expect(sanitizeForStandardPdfFont('Đorđe')).toBe('Dorde');
  });

  it('decompose et retire les diacritiques combinantes pour les lettres d Europe centrale/orientale (ž reste tel quel : deja WinAnsi)', () => {
    expect(sanitizeForStandardPdfFont('Ana ș Ț')).toBe('Ana s T');
    expect(sanitizeForStandardPdfFont('čřžąę')).toBe('cržae');
  });

  it('remplace par `?` les symboles/emoji sans equivalent (jamais un plantage)', () => {
    expect(sanitizeForStandardPdfFont('✓')).toBe('?');
    expect(sanitizeForStandardPdfFont('😀')).toBe('?');
  });

  it("preserve `\\n` (cesure STRUCTURELLE consommee par le moteur de mise en page, pas un caractere a assainir)", () => {
    expect(sanitizeForStandardPdfFont('ligne 1\nligne 2')).toBe('ligne 1\nligne 2');
  });

  it('gere une chaine vide', () => {
    expect(sanitizeForStandardPdfFont('')).toBe('');
  });
});

describe('sanitizeFieldValues', () => {
  it('applique la sanitization a toutes les valeurs d un enregistrement', () => {
    const values = { 'customer.company_name': 'Łukasz Sp. z o.o.', 'quote.number': 'DEV-2026-00042' };
    expect(sanitizeFieldValues(values)).toEqual({
      'customer.company_name': 'Lukasz Sp. z o.o.',
      'quote.number': 'DEV-2026-00042',
    });
  });
});
