/**
 * Arithmetique decimale pure sur les montants (Money, 2 decimales) et les
 * taux (Rate, 4 decimales) du contrat Gestion commerciale — regle API
 * Sprint 5 : jamais de flottant IEEE-754 sur un prix. Tout passe par des
 * entiers `bigint` (centimes pour Money, dix-millemes pour Rate).
 *
 * Hypothese volontaire (documentee, pas un oubli) : ce module n est PAS une
 * librairie decimale generaliste. Il suppose des couts et des taux toujours
 * positifs ou nuls (`nonNegativeRateSchema`, couts de production reels) et
 * n a pas a arrondir correctement des operandes negatifs — `SingleCostPricingEngine`
 * est son seul appelant.
 *
 * Arrondi : au centime le plus proche, moitie superieure (round-half-up),
 * appliquee une seule fois en fin de chaine de calcul (CA4), jamais sur un
 * resultat intermediaire.
 */

const MONEY_PATTERN = /^(-?)(\d+)\.(\d{2})$/;
const RATE_PATTERN = /^(-?)(\d+)\.(\d{4})$/;

/** Precision d un Rate : "0.5000" vaut 5000 dix-millemes, soit 50 %. */
const RATE_SCALE = 10_000n;

export function parseMoneyToCents(amount: string): bigint {
  const match = MONEY_PATTERN.exec(amount);
  if (!match) {
    throw new Error(`Montant invalide : "${amount}" (attendu au format Money, ex. "12.50").`);
  }
  // Groupes toujours definis quand `match` reussit : le pattern n a pas de
  // groupe optionnel (`noUncheckedIndexedAccess` les type pourtant en
  // `string | undefined`).
  const cents = BigInt(match[2]!) * 100n + BigInt(match[3]!);
  return match[1] === '-' ? -cents : cents;
}

export function formatCentsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const integer = absolute / 100n;
  const fraction = absolute % 100n;
  return `${negative ? '-' : ''}${integer.toString()}.${fraction.toString().padStart(2, '0')}`;
}

export function parseRateToBasisPoints(rate: string): bigint {
  const match = RATE_PATTERN.exec(rate);
  if (!match) {
    throw new Error(`Taux invalide : "${rate}" (attendu au format Rate, ex. "0.5000").`);
  }
  const basisPoints = BigInt(match[2]!) * RATE_SCALE + BigInt(match[3]!);
  return match[1] === '-' ? -basisPoints : basisPoints;
}

/**
 * Applique un taux a un montant deja en centimes : `amountCents * (1 +/- rate)`,
 * `sign` valant `1` pour AJOUTER une marge (`value_type: margin_rate`) et
 * `-1` pour RETRANCHER une remise (`value_type: discount_rate`), arrondi au
 * centime le plus proche (CA4).
 */
export function applyRateToCents(amountCents: bigint, rateBasisPoints: bigint, sign: 1 | -1): bigint {
  const factor = RATE_SCALE + BigInt(sign) * rateBasisPoints;
  const numerator = amountCents * factor;
  return roundDivHalfUp(numerator, RATE_SCALE);
}

/** Division entiere arrondie au plus proche, moitie superieure. Suppose `numerator >= 0` et `denominator > 0`. */
function roundDivHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}
