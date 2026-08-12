import { buildEdgeFunctionUrl, buildPublicMockupUrl } from '../../modules/shops/api/mockup-urls.ts';
import type { MockupGateway, MockupParams, MockupSpecs } from '../../modules/shops/application/mockup-gateway.ts';
import { publicAnonKey, supabaseUrl } from '../../../utils/supabase/info.tsx';
export class SupabaseBrowserMockupGateway implements MockupGateway {
  private readonly publicBucketBaseUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/product_mockups`;
  private readonly generatorUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mockup-generator`;
  publicImageUrl(params: MockupParams & { view?: 'front' | 'back' }) { return buildPublicMockupUrl(this.publicBucketBaseUrl, params); }
  previewUrl(specs: MockupSpecs) { return buildEdgeFunctionUrl(this.generatorUrl, specs); }
  async generate(specs: MockupSpecs, signal: AbortSignal): Promise<Blob> {
    const response = await fetch(this.previewUrl(specs), { method: 'GET', headers: { Authorization: `Bearer ${publicAnonKey}` }, signal });
    if (!response.ok) throw new Error(`mockup_generation_failed:${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error(`mockup_invalid_content_type:${blob.type}`);
    return blob;
  }
}
export const browserMockupGateway: MockupGateway = new SupabaseBrowserMockupGateway();
