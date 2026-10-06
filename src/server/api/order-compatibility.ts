/**
 * Signal RFC 9745 des lectures de commandes remplacées le 6 octobre 2026.
 *
 * Aucune date de retrait n'est annoncée tant que les consommateurs internes
 * et externes ne sont pas inventoriés. L'absence volontaire de `Sunset`
 * évite de publier une échéance que le produit n'a pas encore arbitrée.
 */
const ORDER_API_DEPRECATION_DATE = '@1791244800';

export function deprecatedOrderRouteHeaders(successorPath: string): Readonly<Record<string, string>> {
  return {
    Deprecation: ORDER_API_DEPRECATION_DATE,
    Link: `<${successorPath}>; rel="successor-version"`,
  };
}
