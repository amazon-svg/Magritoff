/**
 * Resolution des VALEURS d un devis vers le catalogue de champs positionnable
 * du contrat (`DocumentFieldId`/`DocumentLineFieldId`, openapi
 * `magrit-core.v1.yaml`, docs/api/CONVENTIONS.md §8.18 §3). Fonctions PURES :
 * aucun acces reseau, aucun acces base, aucune horloge lue — `issuedAt` est
 * RECU en parametre (meme discipline que `renderQuoteDocument`, c est le
 * defaut exact reproche a `renderQuoteHtml()` par le constat (e) de
 * §8.13septies, a ne jamais reconduire).
 *
 * Separee du MOTEUR DE DESSIN (`quote-document-renderer.ts`) pour deux
 * raisons : (1) elle est testable seule, sans pdf-lib ni police ; (2) elle
 * fixe EN UN SEUL ENDROIT la correspondance donnee-metier -> valeur imprimee,
 * la meme que celle deja utilisee comme JEU D EXEMPLE par l editeur de
 * coordonnees (`document-templates/ui/workspace/field-editor/sample-quote.ts`,
 * `BASE_FIELDS`), pour qu aucune des deux ne diverge de l autre en silence.
 *
 * ── Deux ecarts de donnees, DELIBEREMENT rendus par `null` ──────────────────
 * `quote.customer_reference` : AUCUNE colonne de ce nom n existe sur
 * `commercial_quotes` (E10.3/E10.9/E10.10a) — le champ est publie au contrat
 * (`DocumentFieldId`) mais n a jamais ete cable cote entete de devis. Rendu
 * `null` (rien n est imprime, jamais un tiret) plutot qu invente. Signale au
 * rapport de fin de story E10.10b-4c : combler ce trou est une story
 * distincte sur le module `commercial-quotes`, hors perimetre ici.
 *
 * `line.product_config_summary` : `product_config` est un JSON dont le SCHEMA
 * varie par produit (chiffrage Clariprint, ligne libre...), sans mapping
 * metier existant ailleurs dans le depot (verifie : aucun `summarizeProduct*`
 * dans `src/`). `summarizeProductConfig` ci-dessous produit un resume
 * GENERIQUE (paire cle/valeur des champs primitifs), pas une mise en forme
 * imprimeur ("200 ex. — 135g couche brillant") qui exigerait un mapping par
 * gamme de produit — hors perimetre de ce lot, signale au rapport.
 */
import type { DocumentFieldId, DocumentLineFieldId } from '../../document-templates/api/contracts.ts';
import {
  formatMoneyFrench,
  formatRatePercentFrench,
  formatShortFrenchDate,
  formatShortFrenchDateFromTimestamp,
} from './document-value-formatting.ts';
import { sanitizeFieldValues } from './document-text-sanitization.ts';

export type ResolvableQuoteHeader = Readonly<{
  number: string;
  /** Instant du PREMIER envoi (`sent_at`), passe en parametre par l appelant (jamais lu d une horloge ici). */
  issuedAt: string;
  /** `YYYY-MM-DD`, ou `null` si non fixee. */
  validUntil: string | null;
}>;

export type ResolvableCustomer = Readonly<{
  /** `null` pour un client `individual` (contrat : valeur absente = rien imprime). */
  companyName: string | null;
  /** Nom complet de l interlocuteur PRINCIPAL, resolu par l appelant (jamais recalcule ici). */
  contactName: string | null;
  billingLine1: string | null;
  billingLine2: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  /** Code ISO 3166-1 alpha-2 (`FR`), tel que porte par `customers.billing_address`. */
  billingCountry: string | null;
  email: string | null;
  phone: string | null;
  siret: string | null;
  vatNumber: string | null;
}>;

/**
 * Totaux DEJA FILTRES par `show_discounts` : l appelant ne passe PAS
 * `linesSubtotal`/`globalDiscount` quand `show_discounts` vaut `false` — la
 * regle de filtrage reste SERVEUR (E10.10b-1 decision 3), appliquee UNE FOIS,
 * ici, jamais par la carte de champs (contrat §8.18 §3).
 */
export type ResolvableTotals = Readonly<{
  linesSubtotal: string | null;
  globalDiscount: string | null;
  netTotal: string;
  vatRate: string;
  vatAmount: string;
  totalInclTax: string;
}>;

export type ResolvableLine = Readonly<{
  position: number;
  label: string;
  productConfig: Readonly<Record<string, unknown>>;
  quantity: number;
  /**
   * DEJA FILTRES par `show_discounts` (meme discipline que `ResolvableTotals`) :
   * `null` quand les remises ne doivent pas apparaitre, jamais recalcule ici.
   * Miroir exact de `api_get_storefront_quote` (`price_before_discount`,
   * `discount_rate`), memes noms de colonnes source
   * (`customer_price`/`discount_rate`).
   */
  priceBeforeDiscount: string | null;
  discountRate: string | null;
  /** `sale_price` — TOUJOURS imprime, remises visibles ou non. */
  price: string;
}>;

export type DocumentFieldValues = Readonly<Partial<Record<DocumentFieldId, string>>>;
export type DocumentLineFieldValues = Readonly<Partial<Record<DocumentLineFieldId, string>>>;

/**
 * Resume GENERIQUE d un `product_config` (paires cle/valeur des champs
 * primitifs du premier niveau, jointes par ` · `). Ecart de perimetre
 * documente en tete de fichier : ce n est PAS une mise en forme imprimeur,
 * seulement un repli qui evite qu un tableau de lignes reste totalement vide
 * sur cette colonne.
 */
export function summarizeProductConfig(productConfig: Readonly<Record<string, unknown>>): string | null {
  const entries = Object.entries(productConfig).filter(
    ([key, value]) =>
      (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
      // qa-review (non bloquant) : un identifiant TECHNIQUE (`clariprint_product_id`,
      // `id`) n a aucun sens pour le client qui lit le devis — filtre avant
      // impression plutot qu expose tel quel.
      key !== 'id' &&
      !key.toLowerCase().endsWith('_id'),
  );
  if (entries.length === 0) return null;
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
}

/**
 * Construit la carte `DocumentFieldId -> valeur imprimable` pour UN devis.
 * Une cle ABSENTE de l objet rendu signifie « rien n est imprime » (contrat :
 * jamais un tiret, jamais un zero) — c est au moteur de dessin de ne rien
 * tracer pour un champ absent, jamais a ce resolveur de fabriquer une valeur
 * de repli.
 */
export function resolveDocumentFieldValues(
  quote: ResolvableQuoteHeader,
  customer: ResolvableCustomer,
  totals: ResolvableTotals,
): DocumentFieldValues {
  const values: Record<string, string> = {
    'quote.number': quote.number,
    'quote.issued_at': formatShortFrenchDateFromTimestamp(quote.issuedAt),
    'totals.net_total': formatMoneyFrench(totals.netTotal),
    'totals.vat_rate': formatRatePercentFrench(totals.vatRate),
    'totals.vat_amount': formatMoneyFrench(totals.vatAmount),
    'totals.total_incl_tax': formatMoneyFrench(totals.totalInclTax),
  };

  // `quote.customer_reference` : ECART DE DONNEES documente en tete de
  // fichier — aucune source, jamais renseigne.

  if (quote.validUntil !== null) {
    values['quote.valid_until'] = formatShortFrenchDate(quote.validUntil);
  }
  if (customer.companyName !== null && customer.companyName.trim() !== '') {
    values['customer.company_name'] = customer.companyName;
  }
  if (customer.contactName !== null && customer.contactName.trim() !== '') {
    values['customer.contact_name'] = customer.contactName;
  }
  if (customer.billingLine1 !== null) values['customer.billing_line1'] = customer.billingLine1;
  if (customer.billingLine2 !== null) values['customer.billing_line2'] = customer.billingLine2;
  if (customer.billingPostalCode !== null) values['customer.billing_postal_code'] = customer.billingPostalCode;
  if (customer.billingCity !== null) values['customer.billing_city'] = customer.billingCity;
  if (customer.billingCountry !== null) values['customer.billing_country'] = customer.billingCountry;
  if (customer.email !== null) values['customer.email'] = customer.email;
  if (customer.phone !== null) values['customer.phone'] = customer.phone;
  if (customer.siret !== null) values['customer.siret'] = customer.siret;
  if (customer.vatNumber !== null) values['customer.vat_number'] = customer.vatNumber;

  const addressBlock = [
    customer.billingLine1,
    customer.billingLine2,
    [customer.billingPostalCode, customer.billingCity].filter((part) => part !== null).join(' ').trim(),
    customer.billingCountry,
  ].filter((line) => line !== null && line.trim() !== '');
  if (addressBlock.length > 0) {
    values['customer.billing_address_block'] = addressBlock.join('\n');
  }

  if (totals.linesSubtotal !== null) values['totals.lines_subtotal'] = formatMoneyFrench(totals.linesSubtotal);
  if (totals.globalDiscount !== null) values['totals.global_discount'] = formatMoneyFrench(totals.globalDiscount);

  // qa-review B5 (BLOQUANT, corrige) — assainissement WinAnsi EN DERNIER,
  // sur les valeurs finales : un caractere hors repertoire (ex. "Ł" dans un
  // nom de client) ne doit plus jamais faire echouer `pdf-lib` a l ecriture.
  return sanitizeFieldValues(values) as DocumentFieldValues;
}

/** Construit la carte `DocumentLineFieldId -> valeur imprimable` pour UNE ligne. */
export function resolveDocumentLineFieldValues(line: ResolvableLine): DocumentLineFieldValues {
  const values: Record<string, string> = {
    'line.position': String(line.position),
    'line.label': line.label,
    'line.quantity': String(line.quantity),
    'line.price': formatMoneyFrench(line.price),
  };

  const summary = summarizeProductConfig(line.productConfig);
  if (summary !== null) values['line.product_config_summary'] = summary;
  if (line.priceBeforeDiscount !== null) {
    values['line.price_before_discount'] = formatMoneyFrench(line.priceBeforeDiscount);
  }
  if (line.discountRate !== null) values['line.discount_rate'] = formatRatePercentFrench(line.discountRate);

  // qa-review B5 — meme assainissement que `resolveDocumentFieldValues` (une
  // designation de ligne collee depuis un cahier des charges est la source
  // la plus probable d un caractere hors WinAnsi).
  return sanitizeFieldValues(values) as DocumentLineFieldValues;
}
