/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3 / 5.3) — référentiel des
 * finitions Clariprint. Données pures du vocabulaire Clariprint, créées ici
 * pour que BCP-2 (normaliseur) et BCP-7 (affichage acheteur) l'importent
 * sans se disputer le fichier.
 *
 * Les cinq valeurs ci-dessous sont celles du prompt Magrit (point 5.3) — pas
 * la page `JsonVarnish` de Clariprint, absente du dépôt. **Les libellés sont
 * une proposition**, validée par Arnaud à la recette, sans rien bloquer.
 *
 * Règle opposable : **un code inconnu est masqué, jamais affiché** — ne
 * jamais montrer à l'acheteur un code technique brut (`PELLIC_ACETATE_MAT`
 * vu tel quel est un des défauts constatés au smoke du 15/09).
 */

/** Ligne masquée : aucune finition, ou code non reconnu. */
const NO_FINISHING_CODE = '';

export const CLARIPRINT_FINISHING_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [NO_FINISHING_CODE]: '',
  PELLIC_ACETATE_BRILLANT: 'Pelliculage brillant',
  PELLIC_ACETATE_MAT: 'Pelliculage mat',
  OFFSET_SATIN: 'Vernis satiné',
  UVS_MAT_RESERVE: 'Vernis sélectif mat',
});

/**
 * Libellé acheteur d'un code de finition, ou `null` si le code est vide ou
 * inconnu du référentiel (point 5.3 : « code inconnu → masqué, jamais
 * affiché »).
 */
export function getClariprintFinishingLabel(code: string): string | null {
  if (code === NO_FINISHING_CODE) return null;
  const label = CLARIPRINT_FINISHING_LABELS[code];
  return typeof label === 'string' && label.length > 0 ? label : null;
}

/**
 * Formate une combinaison de codes de finition : les libellés connus, joints
 * par « + ». Si aucun n'est connu, `null` (la ligne est masquée) — point
 * 5.3.
 */
export function formatClariprintFinishingLabel(codes: string | readonly string[]): string | null {
  const list = Array.isArray(codes) ? codes : [codes as string];
  const labels = list
    .map((code) => getClariprintFinishingLabel(code))
    .filter((label): label is string => label !== null);
  return labels.length > 0 ? labels.join(' + ') : null;
}
