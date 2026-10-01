/** Reproduit la normalisation des recherches texte des adaptateurs PostgreSQL. */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Le filtre pricing neutralise aussi `%`, reserve aux motifs SQL. */
export function sanitizePriceRuleSearchTerm(raw: string): string {
  return raw.replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim();
}
