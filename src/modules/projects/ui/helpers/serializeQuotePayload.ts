/**
 * Normalisation des montants d un produit atelier avant persistance dans
 * `project_items.quote_payload` (story E10.1, C3 qa-review).
 *
 * Les composants atelier (ProductCard, QuoteModal, CartButton…) manipulent
 * des montants en `number` pour l affichage et l arithmetique d ecran — ce
 * n est pas ce qui est en cause ici, et cette fonction NE MODIFIE PAS ces
 * usages. Mais docs/api/CONVENTIONS.md §5 est stricte : un montant PERSISTE
 * (donc destine a etre relu, notamment par E10.3 qui construira ses lignes
 * de devis directement sur ce payload) est une CHAINE decimale a deux
 * decimales, jamais un flottant JSON. Sans cette normalisation au moment de
 * l ecriture, E10.3 heriterait de flottants dans `quote_payload` sans que
 * rien ne le signale — un flottant JSON perd des centimes a l arrondi de
 * TVA et de remise (meme raison que `Money` au contrat OpenAPI).
 *
 * Ne touche que les champs monetaires CONNUS de la forme produite par
 * `ChatInterface.parseConfigsToProducts()` / `ProductCard.tsx` : `price` et
 * `clariprintQuote.{priceHT, costs.{paper,print,makeready,packaging,delivery,total}}`.
 * Tout le reste du produit (quantite, format, matiere...) est copie tel
 * quel.
 */

const MONEY_PATTERN = /^-?[0-9]{1,10}\.[0-9]{2}$/;

/** `null` si `value` n est ni un flottant fini ni deja une chaine Money valide. */
export function toMoneyString(value: unknown): string | null {
  if (typeof value === 'string' && MONEY_PATTERN.test(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  return null;
}

const CLARIPRINT_COST_KEYS = ['total', 'paper', 'print', 'makeready', 'packaging', 'delivery'] as const;

export function serializeQuotePayloadMoney(
  product: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...product };

  if ('price' in clone) {
    const serialized = toMoneyString(clone['price']);
    if (serialized !== null) clone['price'] = serialized;
  }

  const clariprintQuote = clone['clariprintQuote'];
  if (clariprintQuote && typeof clariprintQuote === 'object' && !Array.isArray(clariprintQuote)) {
    const nextQuote: Record<string, unknown> = { ...(clariprintQuote as Record<string, unknown>) };

    if ('priceHT' in nextQuote) {
      const serialized = toMoneyString(nextQuote['priceHT']);
      if (serialized !== null) nextQuote['priceHT'] = serialized;
    }

    const costs = nextQuote['costs'];
    if (costs && typeof costs === 'object' && !Array.isArray(costs)) {
      const nextCosts: Record<string, unknown> = { ...(costs as Record<string, unknown>) };
      for (const key of CLARIPRINT_COST_KEYS) {
        if (key in nextCosts) {
          const serialized = toMoneyString(nextCosts[key]);
          if (serialized !== null) nextCosts[key] = serialized;
        }
      }
      nextQuote['costs'] = nextCosts;
    }

    clone['clariprintQuote'] = nextQuote;
  }

  return clone;
}
