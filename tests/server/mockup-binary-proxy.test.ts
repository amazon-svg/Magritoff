import { describe, expect, it, vi } from 'vitest';
import { proxyMockupBinary } from '@/adapters/supabase/mockup-binary-proxy';

describe('façade binaire mockups', () => {
  it('relaie un asset public Storage sans exposer son URL', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }));
    const request = new Request('https://magrit.test/api/v1/mockups/public/tenant-1/shop-1/product-1_v7.png');
    const response = await proxyMockupBinary(request, 'http://kong:8000', 'anon', fetchMock as unknown as typeof fetch);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(fetchMock).toHaveBeenCalledWith('http://kong:8000/storage/v1/object/public/product_mockups/tenant-1/shop-1/product-1_v7.png', expect.objectContaining({ headers: { Authorization: 'Bearer anon' } }));
  });

  it('relaie le générateur avec une liste fermée de paramètres', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } }));
    const request = new Request('https://magrit.test/api/v1/mockups/render?tenant=t&shop=s&product=p&width=148&height=210&productName=Flyer&primaryColor=%231e3a8a&ignored=secret');
    const response = await proxyMockupBinary(request, 'https://supabase.test', 'anon', fetchMock as unknown as typeof fetch);
    expect(response.status).toBe(200);
    const target = String(fetchMock.mock.calls[0]?.[0]);
    expect(target).toContain('/functions/v1/mockup-generator?');
    expect(target).not.toContain('ignored');
  });

  it('rejette les dimensions invalides avant le générateur', async () => {
    const fetchMock = vi.fn();
    const response = await proxyMockupBinary(new Request('https://magrit.test/api/v1/mockups/render?tenant=t&shop=s&product=p&width=-1&height=210&productName=Flyer&primaryColor=%231e3a8a'), 'https://supabase.test', 'anon', fetchMock as unknown as typeof fetch);
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
