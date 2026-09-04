export { DEFAULT_TAX_RATE, applyTax, extractTaxAmount, formatTaxLabel, getTaxRate } from './tax';
export type { TaxRegime } from './tax';
export {
  isMarginEditable,
  lineTotal,
  marginFromPrice,
  priceFromMargin,
  round2,
  sumLinesHT,
} from './quoteMath';
export type { QuoteLineTotalsInput } from './quoteMath';
