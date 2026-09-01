/**
 * SupabaseCustomersRepository — discrimination des violations de contrainte
 * unique (story E10.4, m2 qa-review).
 *
 * Avant correction, toute violation 23505 etait mappee sur
 * `customer.siret_already_used`, y compris sur `createContact`/
 * `updateContact` ou la seule contrainte unique possible est
 * `customer_contacts_primary_uidx` — message et code trompeurs sur une
 * operation d interlocuteur.
 */
import { describe, expect, it } from 'vitest';
import { CustomerCommandRejectedError } from '@/modules/customers/application/customers-repository';
import { sanitizeSearchTerm, toDomainError } from '@/adapters/supabase/customers-repository';

describe('toDomainError — discrimination par contrainte (23505)', () => {
  it('mappe la contrainte SIRET sur customer.siret_already_used (409)', () => {
    const error = toDomainError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_tenant_siret_uidx"',
      },
      'fallback',
    );
    expect(error).toBeInstanceOf(CustomerCommandRejectedError);
    expect((error as CustomerCommandRejectedError).code).toBe('customer.siret_already_used');
  });

  it('mappe la contrainte de principal unique sur customer.primary_contact_conflict, pas sur le SIRET', () => {
    const error = toDomainError(
      {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customer_contacts_primary_uidx"',
      },
      'fallback',
    );
    expect(error).toBeInstanceOf(CustomerCommandRejectedError);
    expect((error as CustomerCommandRejectedError).code).toBe('customer.primary_contact_conflict');
    expect((error as CustomerCommandRejectedError).message).not.toContain('SIRET');
  });

  it('lit le nom de la contrainte depuis `details` si `message` ne le porte pas', () => {
    const error = toDomainError(
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        details: 'Key already exists, constraint "customer_contacts_primary_uidx" violated.',
      },
      'fallback',
    );
    expect((error as CustomerCommandRejectedError).code).toBe('customer.primary_contact_conflict');
  });

  it('retombe sur le SIRET par defaut si la contrainte est inconnue (comportement historique)', () => {
    const error = toDomainError({ code: '23505', message: 'duplicate key value' }, 'fallback');
    expect((error as CustomerCommandRejectedError).code).toBe('customer.siret_already_used');
  });
});

describe('sanitizeSearchTerm — neutralise la grammaire de filtre PostgREST (m3)', () => {
  it('laisse une recherche ordinaire intacte', () => {
    expect(sanitizeSearchTerm('Imprimerie IPA')).toBe('Imprimerie IPA');
  });

  it('retire les virgules qui casseraient un .or(...) en 500', () => {
    expect(sanitizeSearchTerm('Martin, Paris')).toBe('Martin  Paris');
  });

  it('retire les parentheses (grammaire and()/or())', () => {
    expect(sanitizeSearchTerm('Dupont (Sarl)')).toBe('Dupont  Sarl');
  });

  it('supprime les espaces superflus en tete et en fin apres neutralisation', () => {
    expect(sanitizeSearchTerm(',Martin,')).toBe('Martin');
  });
});
