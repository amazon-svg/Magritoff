import type { ClariprintQuoteOutcome, ClariprintQuoteVerdict } from './clariprint-quote-verdict.ts';

/**
 * BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) — port de journalisation
 * injecté dans la passerelle. Testable : un test peut fournir un faux
 * `ClariprintQuoteLogger` et espionner ce qu'il reçoit, sans dépendre de
 * `console`. C'est `supabase/functions/magrit-api/index.ts` qui compose la
 * version console (§8.25 point 2.3 : « info pour un succès, warn pour un
 * refus, error pour une indisponibilité ou une configuration absente »).
 */
export type ClariprintQuoteLogEntry = Readonly<{
  event: 'clariprint.quote';
  requestId: string;
  outcome: ClariprintQuoteOutcome;
  verdict: ClariprintQuoteVerdict;
}>;

export interface ClariprintQuoteLogger {
  log(entry: ClariprintQuoteLogEntry): void;
}

/** Défaut sûr : aucune écriture, pour les compositions/tests qui n'en fournissent pas. */
export const noopClariprintQuoteLogger: ClariprintQuoteLogger = {
  log() {
    /* aucune écriture */
  },
};
