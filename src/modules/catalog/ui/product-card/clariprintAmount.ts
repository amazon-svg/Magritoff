/**
 * Formatage defensif d un montant Clariprint pour affichage (bloc « Succès
 * Clariprint » de `ProductCardPrix.tsx`).
 *
 * Story E10.1 (qa-review, conflit C3/C4) : un premier correctif serialisait
 * les montants d un chiffrage repris depuis un projet en chaine decimale
 * DANS le payload de rejeu lui-meme, ce qui faisait planter ce rendu —
 * `(clariprintQuote.costs.total || clariprintQuote.priceHT || 0).toFixed(2)`
 * leve `TypeError: ... .toFixed is not a function` des qu un de ces champs
 * est une chaine plutot qu un number. Le correctif retenu (voir
 * `src/modules/projects/ui/helpers/serializeQuotePayload.ts`) garde
 * desormais le payload de rejeu en `number` ; cette fonction est une seconde
 * ligne de defense, independante de la forme amont : elle ne plante JAMAIS,
 * quelle que soit la valeur recue.
 */
export function formatClariprintAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toFixed(2);
  }
  return (0).toFixed(2);
}
