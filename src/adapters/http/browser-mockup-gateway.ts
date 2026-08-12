import { buildEdgeFunctionUrl, buildPublicMockupUrl } from '../../modules/shops/api/mockup-urls.ts';
import type { MockupGateway, MockupParams, MockupSpecs } from '../../modules/shops/application/mockup-gateway.ts';

export class BrowserApiMockupGateway implements MockupGateway {
  publicImageUrl(params: MockupParams & { view?: 'front' | 'back' }) { return buildPublicMockupUrl('/api/v1/mockups/public', params); }
  previewUrl(specs: MockupSpecs) { return buildEdgeFunctionUrl('/api/v1/mockups/render', specs); }
  async generate(specs: MockupSpecs, signal: AbortSignal): Promise<Blob> {
    const response = await fetch(this.previewUrl(specs), { method: 'GET', signal });
    if (!response.ok) throw new Error(`mockup_generation_failed:${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`mockup_invalid_content_type:${blob.type}`);
    return blob;
  }
}
export const browserMockupGateway: MockupGateway = new BrowserApiMockupGateway();
