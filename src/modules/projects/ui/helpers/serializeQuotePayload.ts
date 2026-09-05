/**
 * Montants d un produit atelier persistes dans `project_items.quote_payload`
 * (story E10.1, C3 corrige suite qa-review).
 *
 * ── Historique du correctif (a ne pas reintroduire) ────────────────────────
 * Une premiere version convertissait `price`/`clariprintQuote.priceHT`/
 * `clariprintQuote.costs.*` EN PLACE, en chaine decimale, directement dans le
 * payload persiste. Au moment de la reprise (CA5), `ChatInterface.tsx` etale
 * ce payload TEL QUEL dans le produit rendu par `ProductCard` : `resolvePrice()`
 * (priceResolver.ts) exige `typeof clariprintQuote.priceHT === 'number'`,
 * trouvait une chaine, sautait la branche Clariprint et retombait sur
 * `estimateMarketPriceHT()` — exactement le recalcul heuristique que C4
 * devait eliminer. Pire, `ProductCardPrix.tsx` appelle `.toFixed()` sur ces
 * memes champs et plantait au rendu sur une chaine.
 *
 * ── Le choix retenu (option 2 qa-review) ───────────────────────────────────
 * Le payload de REJEU (`price`, `clariprintQuote.*`) reste EN NUMBER, tel
 * qu avant tout correctif C3 : c est ce que `ProductCard`/`resolvePrice`/
 * `ProductCardPrix` savent lire, et c est exactement le contrat implicite de
 * CA5 (« reprendre l iteration sans rejouer Clariprint » suppose de pouvoir
 * re-nourrir les memes composants avec la meme forme qu au premier calcul).
 * Les montants sont DUPLIQUES, en chaine decimale a deux decimales
 * (docs/api/CONVENTIONS.md §5), dans un sous-objet `amounts` ADDITIF du
 * payload — destine a E10.3 (construction de lignes de devis), jamais lu par
 * le chemin de reprise atelier. Aucune des deux formes ne masque l autre.
 */

const MONEY_PATTERN = /^-?[0-9]{1,10}\.[0-9]{2}$/;

/** `null` si `value` n est ni un flottant fini ni deja une chaine Money valide. */
export function toMoneyString(value: unknown): string | null {
  if (typeof value === 'string' && MONEY_PATTERN.test(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  return null;
}

const CLARIPRINT_COST_KEYS = ['total', 'paper', 'print', 'makeready', 'packaging', 'delivery'] as const;
type ClariprintCostKey = (typeof CLARIPRINT_COST_KEYS)[number];

export interface QuotePayloadAmounts {
  /** Miroir Money de `product.price`, si present et numerique/deja valide. */
  price?: string;
  /** Miroir Money de `product.clariprintQuote.priceHT`. */
  clariprint_price_ht?: string;
  /** Miroir Money de `product.clariprintQuote.costs.{...}`. */
  clariprint_costs?: Partial<Record<ClariprintCostKey, string>>;
}

/**
 * Extrait les montants connus d un produit atelier en chaine Money, SANS
 * modifier `product`. Ne lit que la forme produite par
 * `ChatInterface.parseConfigsToProducts()` / `ProductCard.tsx` : `price` et
 * `clariprintQuote.{priceHT, costs.{paper,print,makeready,packaging,delivery,total}}`.
 */
export function extractQuotePayloadAmounts(
  product: Readonly<Record<string, unknown>>,
): QuotePayloadAmounts {
  const amounts: QuotePayloadAmounts = {};

  const price = toMoneyString(product['price']);
  if (price !== null) amounts.price = price;

  const clariprintQuote = product['clariprintQuote'];
  if (clariprintQuote && typeof clariprintQuote === 'object' && !Array.isArray(clariprintQuote)) {
    const quote = clariprintQuote as Record<string, unknown>;

    const priceHT = toMoneyString(quote['priceHT']);
    if (priceHT !== null) amounts.clariprint_price_ht = priceHT;

    const costs = quote['costs'];
    if (costs && typeof costs === 'object' && !Array.isArray(costs)) {
      const nextCosts: Partial<Record<ClariprintCostKey, string>> = {};
      for (const key of CLARIPRINT_COST_KEYS) {
        const serialized = toMoneyString((costs as Record<string, unknown>)[key]);
        if (serialized !== null) nextCosts[key] = serialized;
      }
      if (Object.keys(nextCosts).length > 0) amounts.clariprint_costs = nextCosts;
    }
  }

  return amounts;
}

/**
 * Construit le payload a persister dans `project_items.quote_payload` :
 * `product` recopie SANS MODIFICATION (le rejeu atelier, CA5, en depend),
 * plus un `amounts` additif en chaine decimale (E10.3, jamais lu par la
 * reprise). Omis si aucun montant connu n a ete trouve.
 */
export function buildQuotePayload(
  product: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const amounts = extractQuotePayloadAmounts(product);
  return Object.keys(amounts).length > 0 ? { ...product, amounts } : { ...product };
}
