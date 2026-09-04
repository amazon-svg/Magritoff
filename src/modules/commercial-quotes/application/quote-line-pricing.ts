/**
 * Arithmetique decimale du geste commercial sur une ligne de devis (E10.9
 * CA1-CA3) : derivation de `sale_price` <-> `margin_rate`, puis
 * `discount_rate`/`margin_variation`.
 *
 * Meme discipline que `src/modules/pricing/application/pricing-money.ts`
 * (jamais de flottant IEEE-754 sur un prix, arithmetique entiere en
 * centimes/dix-millemes), mais CE module doit gerer des operandes NEGATIFS
 * (`Rate` signe : une marge de vente ou une remise peuvent etre negatives,
 * CA7 amende — une vente sous le cout est permise, alertee, jamais refusee).
 * `pricing-money.ts` documente explicitement ne PAS geter ce cas (son seul
 * appelant, `SingleCostPricingEngine`, ne manipule que des taux positifs ou
 * nuls) : ce module lui est donc DISTINCT plutot qu etendu, pour ne pas
 * fragiliser une hypothese que `SingleCostPricingEngine` continue de faire.
 *
 * Arrondi : au centime/dix-millieme le plus proche, ARRONDI-DEMI-A-L ECART-
 * DE-ZERO (round-half-away-from-zero) — meme resultat que round-half-up pour
 * un operande positif, et symetrique pour un operande negatif (evite qu un
 * ecart negatif s arrondisse "vers le haut", donc vers zero, ce qui
 * minimiserait artificiellement une remise ou une marge negative).
 */

const MONEY_NON_NEGATIVE_PATTERN = /^([0-9]{1,10})\.([0-9]{2})$/;
const RATE_PATTERN = /^(-?)([0-9]{1,2})\.([0-9]{4})$/;

const CENTS_SCALE = 100n;
const RATE_SCALE = 10_000n;

/** Une ligne dont `production_price` vaut "0.00" : aucun taux ne produit de prix. */
export class MarginNotDerivableError extends Error {
  constructor(message = 'Le taux de marge ne peut pas etre derive sur un cout de production nul.') {
    super(message);
    this.name = 'MarginNotDerivableError';
  }
}

/**
 * Un `margin_rate` negatif au point de produire un `sale_price` NEGATIF
 * (ex. `-2.0000` sur un cout de production strictement positif) — non
 * representable en Money (`moneyNonNegativeSchema`). Distinct de
 * `MarginNotDerivableError` (division par zero) : ici la division est bien
 * definie, c est le RESULTAT qui sort du domaine representable. Une remise ou
 * une marge negative RESTE acceptee (CA7 amende, vente sous le cout) tant que
 * le prix de vente qui en resulte reste >= 0 (qa-review C1).
 */
export class NegativeSalePriceError extends Error {
  constructor(
    message = 'Le taux de marge fourni produirait un prix de vente negatif, non representable.',
  ) {
    super(message);
    this.name = 'NegativeSalePriceError';
  }
}

export function parseMoneyNonNegativeToCents(amount: string): bigint {
  const match = MONEY_NON_NEGATIVE_PATTERN.exec(amount);
  if (!match) {
    throw new Error(`Montant invalide : "${amount}" (attendu Money non negatif, ex. "12.50").`);
  }
  return BigInt(match[1]!) * CENTS_SCALE + BigInt(match[2]!);
}

export function formatCentsToMoneyNonNegative(cents: bigint): string {
  if (cents < 0n) throw new Error('Un montant Money non negatif ne peut pas etre serialise depuis une valeur negative.');
  const integer = cents / CENTS_SCALE;
  const fraction = cents % CENTS_SCALE;
  return `${integer.toString()}.${fraction.toString().padStart(2, '0')}`;
}

export function parseRateToBasisPoints(rate: string): bigint {
  const match = RATE_PATTERN.exec(rate);
  if (!match) {
    throw new Error(`Taux invalide : "${rate}" (attendu Rate, ex. "0.5000" ou "-0.1000").`);
  }
  const magnitude = BigInt(match[2]!) * RATE_SCALE + BigInt(match[3]!);
  return match[1] === '-' ? -magnitude : magnitude;
}

export function formatBasisPointsToRate(basisPoints: bigint): string {
  const negative = basisPoints < 0n;
  const absolute = negative ? -basisPoints : basisPoints;
  const integer = absolute / RATE_SCALE;
  const fraction = absolute % RATE_SCALE;
  return `${negative ? '-' : ''}${integer.toString()}.${fraction.toString().padStart(4, '0')}`;
}

/** `numeric(6,4)` : au-dela de 99.9999 (ou en deca de -99.9999), le taux n est pas representable. */
function isRateRepresentable(basisPoints: bigint): boolean {
  const maxMagnitude = 99n * RATE_SCALE + 9999n;
  return basisPoints <= maxMagnitude && basisPoints >= -maxMagnitude;
}

/** Division entiere arrondie au plus proche, DEMI A L ECART DE ZERO. `denominator > 0`. */
function roundDivHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n;
  const absNumerator = negative ? -numerator : numerator;
  const quotient = absNumerator / denominator;
  const remainder = absNumerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** `sale_price = production_price * (1 + margin_rate)`, arrondi au centime (contrat `UpdateQuoteLineCommand.margin_rate`). */
export function salePriceFromMarginRate(productionPrice: string, marginRate: string): string {
  const productionCents = parseMoneyNonNegativeToCents(productionPrice);
  if (productionCents === 0n) throw new MarginNotDerivableError();
  const marginBasisPoints = parseRateToBasisPoints(marginRate);
  const factor = RATE_SCALE + marginBasisPoints;
  const saleCents = roundDivHalfAwayFromZero(productionCents * factor, RATE_SCALE);
  if (saleCents < 0n) {
    throw new NegativeSalePriceError();
  }
  return formatCentsToMoneyNonNegative(saleCents);
}

/**
 * `sale_margin_rate = (sale_price - production_price) / production_price`
 * (contrat `QuoteLine.sale_margin_rate`). `null` quand `production_price`
 * vaut "0.00" ou quand le rapport sort de l intervalle representable par
 * `numeric(6,4)` — jamais une exception, ce champ etant une SORTIE toujours
 * calculee sur une ligne deja persistee (CA7 amende : jamais bloquant).
 */
export function saleMarginRateOf(salePrice: string, productionPrice: string): string | null {
  const productionCents = parseMoneyNonNegativeToCents(productionPrice);
  if (productionCents === 0n) return null;
  const saleCents = parseMoneyNonNegativeToCents(salePrice);
  const diffCents = saleCents - productionCents;
  const basisPoints = roundDivHalfAwayFromZero(diffCents * RATE_SCALE, productionCents);
  if (!isRateRepresentable(basisPoints)) return null;
  return formatBasisPointsToRate(basisPoints);
}

/**
 * `discount_rate = (customer_price - sale_price) / customer_price` (contrat
 * `QuoteLine.discount_rate`, CA2). Positif quand le commercial descend sous
 * le prix client, negatif quand il le majore. `null` quand `customer_price`
 * vaut "0.00" ou hors intervalle representable.
 */
export function discountRateOf(salePrice: string, customerPrice: string): string | null {
  const customerCents = parseMoneyNonNegativeToCents(customerPrice);
  if (customerCents === 0n) return null;
  const saleCents = parseMoneyNonNegativeToCents(salePrice);
  const diffCents = customerCents - saleCents;
  const basisPoints = roundDivHalfAwayFromZero(diffCents * RATE_SCALE, customerCents);
  if (!isRateRepresentable(basisPoints)) return null;
  return formatBasisPointsToRate(basisPoints);
}

/**
 * `margin_variation = sale_margin_rate - applied_margin_rate` (contrat
 * `QuoteLine.margin_variation`, CA3). `null` exactement quand
 * `saleMarginRate` l est.
 */
export function marginVariationOf(saleMarginRate: string | null, appliedMarginRate: string): string | null {
  if (saleMarginRate === null) return null;
  const diff = parseRateToBasisPoints(saleMarginRate) - parseRateToBasisPoints(appliedMarginRate);
  if (!isRateRepresentable(diff)) return null;
  return formatBasisPointsToRate(diff);
}

/**
 * Recalcule integralement `sale_margin_rate`/`discount_rate`/
 * `margin_variation` a partir d un `sale_price` (deja connu ou derive d un
 * `margin_rate` par `salePriceFromMarginRate`) — point d entree unique du
 * service pour ne jamais dupliquer l enchainement des trois derivations.
 */
export function deriveLineCommercials(
  input: Readonly<{ salePrice: string; productionPrice: string; customerPrice: string; appliedMarginRate: string }>,
): Readonly<{ saleMarginRate: string | null; discountRate: string | null; marginVariation: string | null }> {
  const saleMarginRate = saleMarginRateOf(input.salePrice, input.productionPrice);
  const discountRate = discountRateOf(input.salePrice, input.customerPrice);
  const marginVariation = marginVariationOf(saleMarginRate, input.appliedMarginRate);
  return { saleMarginRate, discountRate, marginVariation };
}

export type QuoteLineWarningInput = Readonly<{
  origin: 'project_item' | 'free';
  quantity: number;
  chiffrageQuantity: number | null;
  salePrice: string;
  productionPrice: string;
}>;

export type QuoteLineWarningResult = Readonly<{
  code: 'negative_margin' | 'production_cost_stale';
  message: string;
  threshold: null;
}>;

/**
 * Alertes calculees sur l etat courant d une ligne (E10.9 CA7 amende).
 * `discount_threshold_exceeded` n est PAS emis ici : le seuil est reporte a
 * E10.11 (droits et reglages commerciaux par role), decision de
 * l orchestrateur — aucune constante arbitraire n est inventee a la place.
 *
 * - `negative_margin` : la ligne se vend STRICTEMENT sous son cout de
 *   production (`sale_price < production_price`) — une marge nulle
 *   (`sale_price === production_price`) n est pas une marge negative.
 * - `production_cost_stale` : uniquement sur une ligne LIEE a un chiffrage
 *   (`origin === 'project_item'`) dont la quantite courante diverge de la
 *   quantite du chiffrage source. Jamais sur une ligne libre, qui n a pas de
 *   chiffrage a comparer.
 */
export function computeQuoteLineWarnings(input: QuoteLineWarningInput): QuoteLineWarningResult[] {
  const warnings: QuoteLineWarningResult[] = [];

  if (parseMoneyNonNegativeToCents(input.salePrice) < parseMoneyNonNegativeToCents(input.productionPrice)) {
    warnings.push({
      code: 'negative_margin',
      message: 'Cette ligne se vend sous son cout de production.',
      threshold: null,
    });
  }

  if (
    input.origin === 'project_item' &&
    input.chiffrageQuantity !== null &&
    input.quantity !== input.chiffrageQuantity
  ) {
    warnings.push({
      code: 'production_cost_stale',
      message:
        'La quantite de cette ligne a change depuis le chiffrage : le cout de production affiche n a pas ete recote.',
      threshold: null,
    });
  }

  return warnings;
}
