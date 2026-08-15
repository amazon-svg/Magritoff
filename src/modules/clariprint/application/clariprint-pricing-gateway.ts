import type { ClariprintQuoteResult } from '../api/contracts.ts';

export type ClariprintPricingErrorKind =
  | 'negative_price'
  | 'nan_price'
  | 'undefined_field'
  | 'missing_required_product'
  | 'network'
  | 'timeout'
  | 'unauthenticated'
  | 'unknown';

export class ClariprintPricingError extends Error {
  constructor(
    public readonly kind: ClariprintPricingErrorKind,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ClariprintError';
  }
}

export interface ClariprintPricingGateway {
  computePrice(input: Readonly<{
    clariprint: Record<string, unknown>;
  }>): Promise<ClariprintQuoteResult>;
  testConnection(): Promise<unknown>;
}

export async function computeClariprintQuoteSafe(
  gateway: Pick<ClariprintPricingGateway, 'computePrice'>,
  clariprintData: Record<string, unknown> | null | undefined,
): Promise<ClariprintQuoteResult> {
  if (!clariprintData) {
    return { success: false, error: 'Configuration produit absente' };
  }
  try {
    return await gateway.computePrice({ clariprint: clariprintData });
  } catch (error) {
    if (error instanceof ClariprintPricingError) {
      return {
        success: false,
        error: error.message,
        ...(typeof error.details === 'string' ? { details: error.details } : {}),
      };
    }
    return {
      success: false,
      error: (error as Error).message || "Erreur reseau lors de l'appel a Clariprint",
    };
  }
}
