/**
 * Fixtures Tenant pour les tests vitest (Story R0 - Spike H).
 *
 * Couvre les 5 regimes fiscaux gerees par getTaxRate() :
 *   metropole_fr  → 20 %
 *   dom_tom       → 8.5 %
 *   franchise_tva → 0 %
 *   export_eu     → 0 %
 *   export_world  → 0 %
 *
 * Plus un fixture "legacy" sans `tax_regime` pour valider le defaulting.
 */

import type { TaxRegime } from '../../src/app/utils/tax';

export interface TenantFixture {
  id: string;
  name: string;
  tax_regime?: TaxRegime | null;
}

export const metropoleTenant: TenantFixture = {
  id: 'tenant-metropole',
  name: 'Imprimerie IPA (Paris)',
  tax_regime: 'metropole_fr',
};

export const domTomTenant: TenantFixture = {
  id: 'tenant-dom-tom',
  name: 'PrintRun (Reunion)',
  tax_regime: 'dom_tom',
};

export const franchiseTenant: TenantFixture = {
  id: 'tenant-franchise',
  name: 'Atelier Solo (auto-entrepreneur)',
  tax_regime: 'franchise_tva',
};

export const exportEuTenant: TenantFixture = {
  id: 'tenant-export-eu',
  name: 'Magrit Iberica (export UE)',
  tax_regime: 'export_eu',
};

export const exportWorldTenant: TenantFixture = {
  id: 'tenant-export-world',
  name: 'Magrit US LLC (export hors UE)',
  tax_regime: 'export_world',
};

/** Tenant existant avant migration R0 — colonne tax_regime absente (legacy). */
export const legacyTenantNoRegime: TenantFixture = {
  id: 'tenant-legacy',
  name: 'Tenant existant pre-R0',
};
