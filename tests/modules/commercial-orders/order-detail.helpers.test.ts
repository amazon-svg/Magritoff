/**
 * Tests unitaires des helpers PURS d `OrderDetailPage` (E10.16) — aucune
 * dependance React, aucun appel reseau, aucun calcul de prix/seuil.
 */
import { describe, expect, it } from 'vitest';
import {
  contactDisplayName,
  customerDisplayName,
  formatOrderDate,
  sourceQuoteStatusLabel,
} from '@/modules/commercial-orders/ui/workspace/order-detail.helpers';

describe('customerDisplayName', () => {
  it('rend la raison sociale pour une entreprise', () => {
    expect(
      customerDisplayName({ type: 'company', company_name: 'Imprimerie IPA', first_name: null, last_name: null }),
    ).toBe('Imprimerie IPA');
  });

  it("rend 'Client' si une entreprise n a pas de raison sociale (defense en profondeur)", () => {
    expect(customerDisplayName({ type: 'company', company_name: null, first_name: null, last_name: null })).toBe(
      'Client',
    );
  });

  it('rend prenom + nom pour un particulier', () => {
    expect(
      customerDisplayName({ type: 'individual', company_name: null, first_name: 'Jean', last_name: 'Dupont' }),
    ).toBe('Jean Dupont');
  });

  it("rend 'Client' pour un particulier sans prenom ni nom", () => {
    expect(customerDisplayName({ type: 'individual', company_name: null, first_name: null, last_name: null })).toBe(
      'Client',
    );
  });
});

describe('contactDisplayName', () => {
  it('rend prenom + nom quand les deux sont presents', () => {
    expect(contactDisplayName({ first_name: 'Marie', last_name: 'Curie', email: 'marie@example.test' })).toBe(
      'Marie Curie',
    );
  });

  it('se replie sur l e-mail si prenom et nom sont absents', () => {
    expect(contactDisplayName({ first_name: null, last_name: null, email: 'contact@example.test' })).toBe(
      'contact@example.test',
    );
  });
});

describe('formatOrderDate', () => {
  it('rend un tiret pour null (jamais une exception)', () => {
    expect(formatOrderDate(null)).toBe('—');
  });

  it('formate un ISO timestamp en date/heure FR', () => {
    const formatted = formatOrderDate('2026-09-09T10:15:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/09\/09\/2026|09\/09\/2026/);
  });
});

describe('sourceQuoteStatusLabel', () => {
  it("libelle 'sent' — devis valide hors portail", () => {
    expect(sourceQuoteStatusLabel('sent')).toBe('devis envoyé, validé hors portail');
  });

  it("libelle 'accepted' — devis accepte depuis le portail client", () => {
    expect(sourceQuoteStatusLabel('accepted')).toBe('devis accepté depuis le portail client');
  });

  it('se replie sur la valeur brute pour une cle inconnue (defense en profondeur)', () => {
    expect(sourceQuoteStatusLabel('unknown_status')).toBe('unknown_status');
  });
});
