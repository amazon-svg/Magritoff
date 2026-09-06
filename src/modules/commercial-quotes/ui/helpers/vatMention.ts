/**
 * Mention legale associee au regime fiscal d un devis (E10.10a, point 6 du
 * cadrage, docs/api/CONVENTIONS.md §8.12).
 *
 * `QuoteTotals.vat_regime` vient du serveur (`tenants.tax_regime`, jamais
 * calcule ici) : cette fonction ne fait QUE choisir le LIBELLE correspondant,
 * un texte fixe par valeur d enum. Aucun calcul de taux, aucune resolution de
 * regime — ce serait le controle metier que ce sprint interdit cote
 * navigateur (`.claude/rules/frontend.md`).
 *
 * `null` (aucune mention) dans deux cas distincts :
 *  - le devis porte une SURCHARGE de TVA (`Quote.vat_rate`) : le serveur rend
 *    alors `vat_regime: null` volontairement (openapi, description de
 *    `QuoteTotals.vat_regime`) — nommer un regime serait une mention legale
 *    FAUSSE sur un document ;
 *  - le regime resolu (`metropole_fr`/`dom_tom`) n appelle aucune mention
 *    particuliere, le taux affiche suffit.
 */
import type { TaxRegimeDto } from '../../api/contracts';

export function vatLegalMention(regime: TaxRegimeDto | null): string | null {
  switch (regime) {
    case 'franchise_tva':
      return 'TVA non applicable, art. 293 B du CGI';
    case 'export_eu':
    case 'export_world':
      return 'Autoliquidation de la TVA par le preneur';
    case 'metropole_fr':
    case 'dom_tom':
    default:
      return null;
  }
}
