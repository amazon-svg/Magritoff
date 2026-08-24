/**
 * quoteMath — calculs purs pour l'edition de devis (S-QUOTES-2).
 *
 * Isole (comme cartMath.ts / *.helpers.ts) pour etre eprouve avec vitest en
 * mode node, sans DOM ni Provider React.
 *
 * Convention marge (decision defaut S-QUOTES-2) : MARGE SUR COUT (markup).
 *   prix_vente = cout * (1 + marge% / 100)
 *   marge%     = (prix_vente - cout) / cout * 100
 *
 * ⚠️ Piege cout = 0 (devis legacy migres, ou prix marche sans cout Clariprint) :
 * la marge n'est pas calculable → marginFromPrice renvoie 0 et l'UI doit
 * desactiver le champ marge (edition du prix seul).
 */

/** Arrondi comptable a 2 decimales (evite les flottants type 0.30000000004). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Prix de vente unitaire HT depuis un cout et une marge % (markup sur cout). */
export function priceFromMargin(costHT: number, marginPct: number): number {
  const cost = Number.isFinite(costHT) ? costHT : 0;
  const m = Number.isFinite(marginPct) ? marginPct : 0;
  return round2(cost * (1 + m / 100));
}

/**
 * Marge % (markup sur cout) depuis un cout et un prix de vente.
 * Retourne 0 si le cout est nul ou negatif (marge non calculable).
 */
export function marginFromPrice(costHT: number, priceHT: number): number {
  if (!Number.isFinite(costHT) || costHT <= 0) return 0;
  const price = Number.isFinite(priceHT) ? priceHT : 0;
  return round2(((price - costHT) / costHT) * 100);
}

/** Total HT d'une ligne : quantite * prix de vente unitaire. */
export function lineTotal(quantity: number, unitPriceHT: number): number {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const p = Number.isFinite(unitPriceHT) ? unitPriceHT : 0;
  return round2(q * p);
}

/** true si la marge est editable (cout strictement positif). */
export function isMarginEditable(costHT: number): boolean {
  return Number.isFinite(costHT) && costHT > 0;
}

export interface QuoteLineTotalsInput {
  line_total_ht: number;
}

/** Somme des totaux de lignes (total HT de l'entete devis). */
export function sumLinesHT(lines: QuoteLineTotalsInput[]): number {
  return round2(lines.reduce((s, l) => s + (Number.isFinite(l.line_total_ht) ? l.line_total_ht : 0), 0));
}
