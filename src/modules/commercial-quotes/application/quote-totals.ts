/**
 * Calcul des totaux de devis (E10.10a, `QuoteTotals`) : sous-total des
 * lignes, remise GLOBALE deduite (prix cible ou taux, miroir exact du geste
 * ligne d E10.9), TVA appliquee EN BAS du devis.
 *
 * Meme discipline arithmetique que `quote-line-pricing.ts` (entiers en
 * centimes/dix-millemes, jamais de flottant IEEE-754), et memes helpers de
 * remise/taux, reutilises tels quels. Un seul ajout : `Money` SIGNE (pas
 * seulement `MoneyNonNegative`), necessaire pour `totals.global_discount` qui
 * peut etre negatif (majoration, point 4 du cadrage E10.10a).
 *
 * ── TVA : table regime -> taux, portee COTE SERVEUR (decision explicite) ───
 * La correspondance vit aujourd hui dans `src/modules/orders/ui/helpers/
 * tax.ts`, c est a dire dans le navigateur : un taux de TVA calcule en UI est
 * exactement le controle metier que `.claude/rules/frontend.md` interdit, et
 * `QuoteTotals` serait sinon incalculable par la facade. Cette table reprend
 * EXACTEMENT les memes valeurs (donnee LEGALE, pas un reglage) sans importer
 * depuis le module `orders`/`ui` — porter la meme constante a deux endroits
 * est le choix assume plutot qu une dependance croisee vers un module UI.
 */
import {
  formatBasisPointsToRate,
  formatCentsToMoneyNonNegative,
  parseMoneyNonNegativeToCents,
  parseRateToBasisPoints,
} from './quote-line-pricing.ts';
import type { QuoteTotalsDto, TaxRegimeDto } from '../api/contracts.ts';

const CENTS_SCALE = 100n;
const RATE_SCALE = 10_000n;

/** Meme table que `TAX_RATE_BY_REGIME` (src/modules/orders/ui/helpers/tax.ts), portee cote serveur. */
export const TAX_REGIME_RATES: Readonly<Record<TaxRegimeDto, string>> = Object.freeze({
  metropole_fr: '0.2000',
  dom_tom: '0.0850',
  franchise_tva: '0.0000',
  export_eu: '0.0000',
  export_world: '0.0000',
});

/** Division entiere arrondie au plus proche, DEMI A L ECART DE ZERO (meme regle que quote-line-pricing.ts). */
function roundDivHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const absNumerator = negative ? -numerator : numerator;
  const quotient = absNumerator / denominator;
  const remainder = absNumerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** `numeric(6,4)` : au-dela de 99.9999 (ou en deca de -99.9999), le taux n est pas representable. */
function isRateRepresentable(basisPoints: bigint): boolean {
  const maxMagnitude = 99n * RATE_SCALE + 9999n;
  return basisPoints <= maxMagnitude && basisPoints >= -maxMagnitude;
}

/** `Money` SIGNE (contrat `Money`, pas `MoneyNonNegative`) : necessaire pour `global_discount`. */
function formatCentsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integer = absolute / CENTS_SCALE;
  const fraction = absolute % CENTS_SCALE;
  return `${negative ? '-' : ''}${integer.toString()}.${fraction.toString().padStart(2, '0')}`;
}

export type QuoteTotalsInput = Readonly<{
  /** Somme des `sale_price` des lignes (deja remisees ligne par ligne, E10.9). `"0.00"` sans ligne. */
  linesSubtotal: string;
  /** `Quote.global_discount_rate`. Exclusif de `targetNetTotal` (deja garanti par le contrat). */
  globalDiscountRate: string | null;
  /** `Quote.target_net_total`. Exclusif de `globalDiscountRate`. */
  targetNetTotal: string | null;
  /**
   * `Quote.vat_rate` : surcharge explicite par devis. `null` = regime du
   * tenant. Contractuellement non negative (`nonNegativeRateSchema`,
   * qa-review E10.10a round 1, B1) ; une valeur negative rencontree ici
   * (donnee corrompue par un autre biais que l API) est CLAMPEE a zero, jamais
   * levee — voir le commentaire au point d usage.
   */
  quoteVatRateOverride: string | null;
  /** `tenants.tax_regime`, toujours renseigne (colonne NOT NULL, defaut `metropole_fr`). */
  tenantTaxRegime: TaxRegimeDto;
}>;

/**
 * Calcule `QuoteTotals` selon l ordre CONTRACTUEL (openapi, description de
 * `QuoteTotals`) : sous-total -> net_total (cible OU taux OU sous-total tel
 * quel) -> remise DEDUITE -> TVA en bas.
 */
export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotalsDto {
  const subtotalCents = parseMoneyNonNegativeToCents(input.linesSubtotal);

  let netTotalCents: bigint;
  if (input.targetNetTotal !== null) {
    netTotalCents = parseMoneyNonNegativeToCents(input.targetNetTotal);
  } else if (input.globalDiscountRate !== null) {
    const rateBasisPoints = parseRateToBasisPoints(input.globalDiscountRate);
    const factor = RATE_SCALE - rateBasisPoints; // (1 - rate), en dix-millemes
    netTotalCents = roundDivHalfAwayFromZero(subtotalCents * factor, RATE_SCALE);
  } else {
    netTotalCents = subtotalCents;
  }
  // `net_total` est `MoneyNonNegative` (contrat) : ne peut jamais devenir
  // negatif ici — `target_net_total` est deja borne >= 0 a la validation, et
  // `global_discount_rate` est borne a `"1.0000"` maximum (factor >= 0).

  const globalDiscountCents = subtotalCents - netTotalCents;

  let effectiveDiscountRate: string | null = null;
  if (subtotalCents !== 0n) {
    const basisPoints = roundDivHalfAwayFromZero(globalDiscountCents * RATE_SCALE, subtotalCents);
    effectiveDiscountRate = isRateRepresentable(basisPoints) ? formatBasisPointsToRate(basisPoints) : null;
  }

  const rawVatRate = input.quoteVatRateOverride ?? TAX_REGIME_RATES[input.tenantTaxRegime];
  const vatRegime = input.quoteVatRateOverride !== null ? null : input.tenantTaxRegime;
  const rawVatRateBasisPoints = parseRateToBasisPoints(rawVatRate);
  // Defense en profondeur (qa-review E10.10a round 1, B1) : le contrat
  // (`nonNegativeRateSchema`) et le CHECK `commercial_quotes_vat_rate_non_
  // negative` (migration 20260906160000) empechent desormais toute ECRITURE
  // d un `vat_rate` negatif — mais cette fonction est sur le chemin de TOUTE
  // LECTURE (`findById`, `findDetailById`, `list()`) : elle ne doit JAMAIS
  // lever, meme si une valeur negative se retrouvait en base par un autre
  // biais (migration future bogguee, ecriture hors API). Un taux negatif est
  // CLAMPE a zero plutot que de faire planter la lecture : c est la valeur la
  // moins arbitraire (aucun regime reel n a de taux negatif), pas une
  // tentative de deviner un taux legal a la place de la donnee corrompue.
  const vatRateBasisPoints = rawVatRateBasisPoints < 0n ? 0n : rawVatRateBasisPoints;
  const vatRate =
    vatRateBasisPoints === rawVatRateBasisPoints ? rawVatRate : formatBasisPointsToRate(vatRateBasisPoints);
  const vatAmountCents = roundDivHalfAwayFromZero(netTotalCents * vatRateBasisPoints, RATE_SCALE);
  const totalInclTaxCents = netTotalCents + vatAmountCents;

  return {
    lines_subtotal: formatCentsToMoneyNonNegative(subtotalCents),
    global_discount: formatCentsToMoney(globalDiscountCents),
    effective_discount_rate: effectiveDiscountRate,
    net_total: formatCentsToMoneyNonNegative(netTotalCents),
    vat_rate: vatRate,
    vat_regime: vatRegime,
    vat_amount: formatCentsToMoneyNonNegative(vatAmountCents),
    total_incl_tax: formatCentsToMoneyNonNegative(totalInclTaxCents),
  };
}

/** `QuoteWarning[]` sur l ETAT du devis (distinct des `QuoteLineWarning[]`, E10.9). */
export function computeQuoteWarnings(
  input: Readonly<{ validUntil: string | null; now: Date }>,
): ReadonlyArray<{ code: 'validity_expired'; message: string }> {
  if (input.validUntil === null) return [];
  // `valid_until` est une DATE seule (YYYY-MM-DD) : comparee a minuit UTC du
  // lendemain, pour qu un devis valide "jusqu au" jour J le reste toute la
  // journee J (une date seule n a pas d heure a elle, la borne haute est donc
  // exclusive du jour suivant).
  const boundary = new Date(`${input.validUntil}T00:00:00.000Z`);
  boundary.setUTCDate(boundary.getUTCDate() + 1);
  if (input.now.getTime() < boundary.getTime()) return [];
  return [
    {
      code: 'validity_expired',
      message: 'La date de validite de ce devis est depassee.',
    },
  ];
}
