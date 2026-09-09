/**
 * Jeu de donnees FICTIF FIXE pour le mode Aperçu (E10.10b-4b, wireframe §2
 * ecran D, Q5 : "jeu de donnees fictif fixe pour cette story", personnalisation
 * hors perimetre). Reprend le devis d exemple du wireframe (DEV-2026-00042,
 * Établissements Dupont & Fils) plus une variante "longue" (20+ lignes) pour
 * la case "Simuler un devis long" (wireframe §2 ecran D).
 *
 * `show_discounts` du contrat (E10.10b-1 decision 3) N EST PAS simule ici :
 * l aperçu montre TOUJOURS les quatre champs `totals.global_discount`/
 * `totals.lines_subtotal`/`line.discount_rate`/`line.price_before_discount`
 * s ils sont positionnes — l imprimeur voit ce que SA carte dessine, pas ce
 * qu un tenant particulier configurerait a l envoi (regle serveur, hors
 * portee de cet apercu client, E10.10b-4c).
 *
 * E10.19a — jeu d exemple de COMMANDE (`SAMPLE_ORDER`/`SAMPLE_ORDER_LONG`),
 * meme discipline que le devis : donnees FICTIVES, y compris pour
 * `order.customer_reference`/`order.expected_delivery_date`, deux champs
 * dont la SOURCE REELLE n existe pas encore cote serveur (`commercial_orders.
 * customer_reference` documente le meme ecart que `quote.customer_reference`
 * ci-dessus, `expected_delivery_date` n a AUCUN chemin d ecriture, §8.17
 * reserve (h)) — l apercu reste un outil de POSITIONNEMENT, il montre a
 * l imprimeur ou la valeur s ecrirait LE JOUR OU elle existera, pas ce que
 * le moteur sait produire aujourd hui (meme parti que `quote.customer_reference`).
 */
import type { DocumentFieldId, DocumentLineFieldId } from '@/modules/document-templates/api/contracts';

export type SampleQuoteLine = Readonly<Record<DocumentLineFieldId, string>>;

/**
 * Carte de valeurs d exemple : `Partial`, PAS `Record` exhaustif — un jeu de
 * donnees de devis n a aucune raison de porter les cinq cles `order.*`
 * (E10.19a), et reciproquement. Une cle absente se comporte comme en
 * production (contrat : "valeur absente = rien imprime").
 */
export type SampleDocumentFields = Readonly<Partial<Record<DocumentFieldId, string>>>;

export type SampleQuote = Readonly<{
  fields: SampleDocumentFields;
  lines: readonly SampleQuoteLine[];
}>;

function line(overrides: Partial<Record<DocumentLineFieldId, string>>): SampleQuoteLine {
  return {
    'line.position': '',
    'line.label': '',
    'line.product_config_summary': '',
    'line.quantity': '',
    'line.price_before_discount': '',
    'line.discount_rate': '',
    'line.price': '',
    ...overrides,
  } as SampleQuoteLine;
}

/**
 * Familles COMMUNES aux deux types de document (`customer.`/`totals.`/
 * `page.`, contrat §4) — un SEUL endroit ou elles sont ecrites, reprises
 * TELLES QUELLES par `BASE_FIELDS` (devis) et `ORDER_BASE_FIELDS` (commande,
 * E10.19a) plutot que dupliquees ou indexees depuis un objet `Partial`
 * (`exactOptionalPropertyTypes` refuse une valeur `string | undefined`
 * copiee vers une cle optionnelle).
 */
const COMMON_FIELDS = {
  'customer.company_name': 'Établissements Dupont & Fils',
  'customer.contact_name': 'Marie Dupont',
  'customer.billing_address_block': 'Établissements Dupont & Fils\n12 rue des Imprimeurs\n75011 Paris',
  'customer.billing_line1': '12 rue des Imprimeurs',
  'customer.billing_line2': '',
  'customer.billing_postal_code': '75011',
  'customer.billing_city': 'Paris',
  'customer.billing_country': 'France',
  'customer.email': 'marie.dupont@dupont-fils.example',
  'customer.phone': '01 23 45 67 89',
  'customer.siret': '123 456 789 00012',
  'customer.vat_number': 'FR12 345678900',
  // Contrat §10 (decision D, E10.19a) : le bon de commande MONTRE les
  // remises, comme le devis — le jeu d exemple les simule donc toujours pour
  // les deux types (l apercu montre ce que LA CARTE dessine, pas ce qu un
  // tenant particulier configurerait a la production).
  'totals.lines_subtotal': '183,00 €',
  'totals.global_discount': '18,00 €',
  'totals.net_total': '165,00 €',
  'totals.vat_rate': '20 %',
  'totals.vat_amount': '33,00 €',
  'totals.total_incl_tax': '198,00 €',
  // qa-review R6 : les trois champs `page.*` ne sont JAMAIS lus tels quels —
  // `PreviewOverlay.tsx` les RECALCULE a chaque rendu depuis le
  // `lines_block` REELLEMENT en cours d edition et le nombre de lignes de
  // l echantillon choisi (`computeDocumentPageCount()`,
  // `pdf-coordinates.ts`). Coder une valeur en dur ici serait fausse des
  // qu un imprimeur regle `rows_per_page` differemment de la valeur
  // implicite au moment ou ce fichier a ete ecrit. Valeurs de secours
  // uniquement si `PreviewOverlay` oubliait de les substituer (ne devrait
  // jamais s afficher).
  'page.number': '—',
  'page.count': '—',
  'page.number_of_count': '—',
} as const;

const BASE_FIELDS: SampleDocumentFields = {
  'quote.number': 'DEV-2026-00042',
  'quote.issued_at': '09/09/2026',
  'quote.valid_until': '09/10/2026',
  'quote.customer_reference': 'CMD-INT-2451',
  ...COMMON_FIELDS,
};

const SHORT_LINES: readonly SampleQuoteLine[] = [
  line({
    'line.position': '1',
    'line.label': 'Flyers A5 recto-verso',
    'line.product_config_summary': '200 ex. — 135g couché brillant',
    'line.quantity': '200',
    'line.price_before_discount': '130,00 €',
    'line.discount_rate': '7,7 %',
    'line.price': '120,00 €',
  }),
  line({
    'line.position': '2',
    'line.label': 'Cartes de visite',
    'line.product_config_summary': '50 ex. — 350g pelliculé mat',
    'line.quantity': '50',
    'line.price_before_discount': '53,00 €',
    'line.discount_rate': '15,1 %',
    'line.price': '45,00 €',
  }),
];

/** Devis d exemple STANDARD (wireframe §2 ecran D), 1 page. */
export const SAMPLE_QUOTE: SampleQuote = Object.freeze({
  fields: BASE_FIELDS,
  lines: SHORT_LINES,
});

/**
 * Variante "longue" (case "Simuler un devis long", wireframe §2 ecran D) :
 * 22 lignes, de quoi declencher visuellement le debordement sur une page de
 * continuation quand `rows_per_page` du gabarit est infrerieur.
 */
export const SAMPLE_QUOTE_LONG: SampleQuote = Object.freeze({
  fields: {
    ...BASE_FIELDS,
    'totals.lines_subtotal': '2 015,00 €',
    'totals.global_discount': '113,50 €',
    'totals.net_total': '1 901,50 €',
    'totals.vat_amount': '380,30 €',
    'totals.total_incl_tax': '2 281,80 €',
  },
  lines: Object.freeze(
    Array.from({ length: 22 }, (_unused, index) =>
      line({
        'line.position': String(index + 1),
        'line.label': `Article de démonstration ${index + 1}`,
        'line.product_config_summary': 'Configuration fictive — aperçu long',
        'line.quantity': String(10 + index),
        'line.price_before_discount': `${(100 + index * 5).toFixed(2)} €`,
        'line.discount_rate': '5,0 %',
        'line.price': `${(95 + index * 5).toFixed(2)} €`,
      }),
    ),
  ),
});

// ---------------------------------------------------------------------------
// E10.19a — jeu d exemple de COMMANDE, pour l apercu d un gabarit
// `document_type: 'order'`. Memes familles communes (`customer.`/`totals.`/
// `page.`) que le devis, reprises TELLES QUELLES ; seule la famille de tete
// change (`order.*` au lieu de `quote.*` — contrat §4, les deux ne se
// melangent jamais sur un meme gabarit).
// ---------------------------------------------------------------------------

const ORDER_BASE_FIELDS: SampleDocumentFields = {
  'order.number': 'CDE-2026-00017',
  'order.created_at': '10/09/2026',
  'order.quote_number': 'DEV-2026-00042',
  'order.customer_reference': 'CMD-INT-2451',
  'order.expected_delivery_date': '24/10/2026',
  ...COMMON_FIELDS,
};

/** Commande d exemple STANDARD, 1 page (memes deux lignes que `SAMPLE_QUOTE`). */
export const SAMPLE_ORDER: SampleQuote = Object.freeze({
  fields: ORDER_BASE_FIELDS,
  lines: SHORT_LINES,
});

/** Variante "longue" (22 lignes), meme usage que `SAMPLE_QUOTE_LONG`. */
export const SAMPLE_ORDER_LONG: SampleQuote = Object.freeze({
  fields: {
    ...ORDER_BASE_FIELDS,
    'totals.lines_subtotal': '2 015,00 €',
    'totals.global_discount': '113,50 €',
    'totals.net_total': '1 901,50 €',
    'totals.vat_amount': '380,30 €',
    'totals.total_incl_tax': '2 281,80 €',
  },
  lines: SAMPLE_QUOTE_LONG.lines,
});
