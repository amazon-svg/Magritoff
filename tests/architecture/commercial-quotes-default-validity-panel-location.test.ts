/**
 * Lot "parametre de validite des devis" (arbitrage Arnaud 2026-09-19, Q18,
 * docs/api/CONVENTIONS.md §8.25 point 13 (3)). Verbatim d Arnaud : « une
 * valeur par defaut qui doit etre aussi un parametre dans le menu devis ».
 *
 * Ce test fixe l EMPLACEMENT du reglage `default_validity_days`, pas son
 * comportement (couvert par `tests/sql/gescom-default-validity-days-30.sql`
 * et par les tests existants de `SupabaseCommercialSettingsRepository`) :
 *   - il DOIT vivre dans l ecran du menu Devis (`QuotesPage.tsx`,
 *     `commercial-quotes`, route `commercial-quotes.workspace.list`,
 *     libelle de navigation "Devis") ;
 *   - il ne DOIT PAS rester (ni etre duplique) dans `PricingRulesPage.tsx`
 *     ("Regles de prix"), ou il vivait avant ce lot -- deux surfaces qui
 *     ecriraient la meme colonne `commercial_settings.default_validity_days`
 *     divergeraient a la premiere retouche (regle constante du projet).
 *
 * AVANT ce lot, ce test echoue : le panneau vivait exclusivement dans
 * `PricingRulesPage.tsx`, absent de `QuotesPage.tsx`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const quotesPage = readFileSync(
  resolve(process.cwd(), 'src/modules/commercial-quotes/ui/workspace/QuotesPage.tsx'),
  'utf8',
);

const pricingRulesPage = readFileSync(
  resolve(process.cwd(), 'src/modules/pricing/ui/workspace/PricingRulesPage.tsx'),
  'utf8',
);

describe('emplacement du reglage de validite par defaut des devis (Q18)', () => {
  it('le menu Devis (QuotesPage) porte le panneau de validite par defaut', () => {
    expect(quotesPage).toContain('function DefaultValidityDaysPanel()');
    expect(quotesPage).toContain('<DefaultValidityDaysPanel />');
    expect(quotesPage).toContain("TEST_IDS.commercialSettings.defaultValiditySection");
    expect(quotesPage).toContain("TEST_IDS.commercialSettings.defaultValidityInput");
    expect(quotesPage).toContain("TEST_IDS.commercialSettings.defaultValiditySaveBtn");
  });

  it('le panneau du menu Devis passe par le client API du module, jamais par un calcul ou une borne recopiee en dur comme seule garde', () => {
    expect(quotesPage).toContain('CommercialSettingsApiClient');
    expect(quotesPage).toContain('api.update({ default_validity_days: parsed }, etag)');
  });

  it('le panneau reste garde par can_manage_pricing dans le menu Devis (ecran ouvert a commercial-quotes.read)', () => {
    expect(quotesPage).toContain("hasCapability('can_manage_pricing')");
    expect(quotesPage).toContain('canManagePricing &&');
  });

  it('PricingRulesPage ne porte plus (et ne duplique pas) le panneau de validite par defaut', () => {
    expect(pricingRulesPage).not.toContain('DefaultValidityDaysPanel');
    expect(pricingRulesPage).not.toContain('defaultValiditySection');
    expect(pricingRulesPage).not.toContain('defaultValidityInput');
    expect(pricingRulesPage).not.toContain('defaultValiditySaveBtn');
  });
});
