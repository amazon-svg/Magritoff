/**
 * Conversion pourcentage saisi <-> taux serialise (`Rate`, contrat), pour la
 * remise globale et la surcharge de TVA d un devis (E10.10a).
 *
 * DUPLIQUE DELIBEREMENT depuis `src/modules/pricing/ui/workspace/rate-format.ts`
 * plutot qu importe : cette paire de fonctions n est pas publiee par l entree
 * UI de `pricing` (`ui/index.ts`), et `pricing` est un module VOISIN, pas un
 * fournisseur declare de `commercial-quotes` — y creuser un import profond
 * violerait la frontiere verifiee par
 * `tests/architecture/modular-ui-boundaries.test.ts` (entrees publiques
 * uniquement pour les imports inter-modules cote UI). Meme precedent deja
 * assume par le SERVEUR pour la table de taux de TVA (`quote-totals.ts`,
 * docs/api/CONVENTIONS.md §8.12bis, decision 6) : une petite conversion
 * stable est dupliquee consciemment plutot que de coupler deux modules pour
 * quelques lignes.
 *
 * ── Difference avec l original : le SIGNE ─────────────────────────────────
 * `pricing/rate-format.ts::toRateString()` rejette une valeur negative (une
 * regle de prix n en a pas besoin). La remise globale d un devis, elle, PEUT
 * etre negative (majoration, §8.12 point 3/decision 3) : `percentToRate()`
 * ci-dessous accepte donc un signe, contrairement a son cousin. `rateToPercent()`
 * est repris a l identique (deja symetrique, meme algorithme string pour
 * eviter l arrondi flottant a l affichage).
 */

/**
 * Convertit un pourcentage saisi ("10", "-15.5") en taux serialise
 * (`"0.1000"`, `"-0.1550"`), ou `null` si non numerique. Aucune borne haute
 * n est appliquee ici (la borne "1.0000" du contrat, `globalDiscountRateSchema`,
 * est verifiee cote serveur ; un depassement cote UI se traduit par un 422
 * lisible, pas une exception locale).
 */
export function percentToRate(percent: string): string | null {
  const trimmed = percent.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const formatted = (parsed / 100).toFixed(4);
  return formatted === '-0.0000' ? '0.0000' : formatted;
}

/**
 * Inverse de `percentToRate()` : convertit un taux serialise (`"0.2900"`,
 * `"-0.1000"`) en pourcentage lisible (`"29"`, `"-10"`) par decalage de
 * virgule sur la CHAINE, jamais par une multiplication flottante —
 * `Number("0.2900") * 100` vaut `28.999999999999996` en IEEE 754.
 */
export function rateToPercent(rate: string): string {
  const negative = rate.startsWith('-');
  const unsigned = negative ? rate.slice(1) : rate;
  const [intPart, fracPartRaw = ''] = unsigned.split('.');
  const fracPart = fracPartRaw.padEnd(4, '0').slice(0, 4);

  const shiftedInt = `${intPart}${fracPart.slice(0, 2)}`.replace(/^0+(?=\d)/, '');
  const shiftedFrac = fracPart.slice(2).replace(/0+$/, '');
  const percent = shiftedFrac.length > 0 ? `${shiftedInt}.${shiftedFrac}` : shiftedInt || '0';
  return negative && percent !== '0' ? `-${percent}` : percent;
}
