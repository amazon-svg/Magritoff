/** Le mode est explicite : un ancien prix de bibliothèque ne change pas de sens. */
export function isFixedPriceProduct(product: { config?: unknown } | null | undefined): boolean {
  const config = product?.config;
  return typeof config === 'object' && config !== null
    && 'pricing_mode' in config && config.pricing_mode === 'fixed_unit';
}
