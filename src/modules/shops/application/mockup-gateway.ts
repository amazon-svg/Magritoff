export interface MockupParams { tenantId: string; shopId: string; productId: string; }
export interface MockupSpecs extends MockupParams { width: number; height: number; productName: string; primaryColor: string; template?: string; view?: 'front' | 'back'; }
export interface MockupGateway {
  publicImageUrl(params: MockupParams & { view?: 'front' | 'back' }): string;
  previewUrl(specs: MockupSpecs): string;
  generate(specs: MockupSpecs, signal: AbortSignal): Promise<Blob>;
}
