/**
 * Helpers PURS d `OrderDetailPage` (E10.16) — derivation d affichage
 * uniquement, AUCUN calcul de prix/seuil/quota (E10.8 gelee, `.claude/
 * rules/frontend.md`) : ce fichier ne fait que composer des chaines
 * d affichage a partir de valeurs deja rendues par l API, jamais un total,
 * une remise ou un prix.
 */
import type { CustomerContactDto, CustomerDetailDto } from '@/modules/customers';
import { PRODUCT_REFERENCE_TIME_ZONE } from '../../../../kernel/clock/index.ts';

/** Nom affichable du client (CA1) — meme regle que `CustomerDetailPage` : societe -> raison sociale, particulier -> prenom+nom. */
export function customerDisplayName(customer: Pick<CustomerDetailDto, 'type' | 'company_name' | 'first_name' | 'last_name'>): string {
  if (customer.type === 'company') return customer.company_name ?? 'Client';
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Client';
}

/** Nom affichable d un interlocuteur (CA1) — replie sur l e-mail si prenom/nom absents (contact importé sans identité complète). */
export function contactDisplayName(contact: Pick<CustomerContactDto, 'first_name' | 'last_name' | 'email'>): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email;
}

/**
 * Formatage FR d un `Timestamp` (CA1 : dates de creation/derniere transition).
 * `null` -> tiret, jamais une exception.
 *
 * `timeZone: PRODUCT_REFERENCE_TIME_ZONE` explicite (qa-review E10.18a
 * round 1, M2) — SANS lui, `toLocaleString` retombe sur le fuseau du
 * NAVIGATEUR, alors que la grille voisine du meme module
 * (`orders-list.helpers.ts`, `formatOrderCreatedAt`) affiche deja dans le
 * fuseau de reference (`docs/api/CONVENTIONS.md` §8.24 point 5 regle 8 :
 * « les bornes ET LES DATES AFFICHEES sont entendues dans Europe/Paris »).
 * Sans cet ajout, un utilisateur a Londres pouvait voir `01/09/2026` dans la
 * grille (filtre "septembre") puis `31/08/2026` sur la fiche de la MEME
 * commande.
 */
export function formatOrderDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PRODUCT_REFERENCE_TIME_ZONE,
  });
}

const SOURCE_QUOTE_STATUS_LABEL: Readonly<Record<string, string>> = Object.freeze({
  sent: 'devis envoyé, validé hors portail',
  accepted: 'devis accepté depuis le portail client',
});

/** Libelle affichable de `source_quote_status` (CA1). Cle inconnue -> repli sur la valeur brute, jamais une exception. */
export function sourceQuoteStatusLabel(sourceQuoteStatus: string): string {
  return SOURCE_QUOTE_STATUS_LABEL[sourceQuoteStatus] ?? sourceQuoteStatus;
}
