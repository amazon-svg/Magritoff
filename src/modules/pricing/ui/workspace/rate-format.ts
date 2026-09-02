/**
 * Conversion pourcentage saisi <-> taux serialise (`Rate`, contrat), partagee
 * par `PriceRuleFormModal` et le panneau de marge publique standard
 * (`PricingRulesPage`) — un seul endroit pour cette paire de fonctions
 * symetriques, jamais de calcul de prix ici (E10.21 hors perimetre).
 */

/** Convertit un pourcentage saisi ("50") en taux `Rate` (`"0.5000"`), ou `null` si invalide/negatif. */
export function toRateString(percent: string): string | null {
  const parsed = Number(percent);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return (parsed / 100).toFixed(4);
}

/**
 * Inverse de `toRateString` : convertit un taux serialise (`"0.2900"`) en
 * pourcentage lisible (`"29"`) par decalage de virgule sur la CHAINE, jamais
 * par une multiplication flottante — `Number("0.2900") * 100` vaut
 * `28.999999999999996` en IEEE 754, un artefact qui n a rien a faire dans un
 * champ de saisie (meme famille de regle que `.claude/rules/db.md` sur les
 * taux, appliquee ici a l affichage plutot qu au stockage).
 */
export function rateToPercentString(rate: string): string {
  const negative = rate.startsWith('-');
  const unsigned = negative ? rate.slice(1) : rate;
  const [intPart, fracPartRaw = ''] = unsigned.split('.');
  const fracPart = fracPartRaw.padEnd(4, '0').slice(0, 4);

  // Decale la virgule de deux rangs vers la droite (x100) : les deux premiers
  // chiffres decimaux rejoignent la partie entiere, les deux derniers restent
  // en decimales.
  const shiftedInt = `${intPart}${fracPart.slice(0, 2)}`.replace(/^0+(?=\d)/, '');
  const shiftedFrac = fracPart.slice(2).replace(/0+$/, '');
  const percent = shiftedFrac.length > 0 ? `${shiftedInt}.${shiftedFrac}` : shiftedInt;
  return negative ? `-${percent}` : percent;
}
