/**
 * S2.16 — Tests unitaires resolvePendingQuotes (bloc "Vos devis en attente").
 *
 * Option C : les devis en cours sont affichés sur la home dashboard (là où
 * QuotesContext est disponible). "En cours" = statusGroup 'en_cours'
 * (draft/sent/pending + statut inconnu). Data-driven : tri created_at desc,
 * section masquée si aucun devis en cours (AC3).
 */

import { describe, expect, it } from 'vitest';
import { resolvePendingQuotes } from '../../src/app/utils/dashboardHomeSections';

const q = (id: string, status: string, created_at?: string) =>
  ({ id, status, created_at }) as { id: string; status: string; created_at?: string };

describe('dashboardHomeSections — resolvePendingQuotes (S2.16)', () => {
  it('ne garde que les devis "en cours" (draft/sent/pending)', () => {
    const list = [
      q('a', 'draft'),
      q('b', 'validated'),
      q('c', 'sent'),
      q('d', 'rejected'),
      q('e', 'pending'),
      q('f', 'won'),
      q('g', 'lost'),
    ];
    expect(resolvePendingQuotes(list, 10).map((x) => x.id).sort()).toEqual(['a', 'c', 'e']);
  });

  it('traite un statut inconnu comme "en cours" (défensif, cf. quoteStatus)', () => {
    expect(resolvePendingQuotes([q('x', 'weird')], 10).map((x) => x.id)).toEqual(['x']);
  });

  it('trie par date de création décroissante', () => {
    const list = [
      q('old', 'draft', '2026-01-01T00:00:00Z'),
      q('new', 'draft', '2026-03-01T00:00:00Z'),
      q('mid', 'draft', '2026-02-01T00:00:00Z'),
    ];
    expect(resolvePendingQuotes(list, 10).map((x) => x.id)).toEqual(['new', 'mid', 'old']);
  });

  it('plafonne au nombre demandé', () => {
    const list = Array.from({ length: 8 }, (_, i) =>
      q(String(i), 'draft', `2026-01-0${i + 1}T00:00:00Z`),
    );
    expect(resolvePendingQuotes(list, 5).length).toBe(5);
  });

  it('retourne [] si aucun devis (AC3 : section masquée)', () => {
    expect(resolvePendingQuotes([], 5)).toEqual([]);
  });

  it('retourne [] si aucun devis en cours (que des validés/rejetés)', () => {
    expect(resolvePendingQuotes([q('a', 'validated'), q('b', 'rejected')], 5)).toEqual([]);
  });

  it('retourne [] si limit <= 0', () => {
    expect(resolvePendingQuotes([q('a', 'draft')], 0)).toEqual([]);
  });
});
