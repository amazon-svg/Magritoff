import { describe, expect, it, vi } from 'vitest';
import { HttpClariprintQuoteGateway } from '@/adapters/clariprint/http-clariprint-quote-gateway';

describe('HttpClariprintQuoteGateway', () => {
  it('normalise le produit et traduit une réponse de prix valide', async () => {
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('login')).toBe('login');
      expect(form.get('password')).toBe('password');
      expect(form.get('action')).toBe('QuoteRequest');
      const data = JSON.parse(form.get('datas') ?? '{}');
      expect(data.clariprint_product).toMatchObject({ quantity: '500', deliveries: { d_livraison: { iso: 'FR-75', quantity: '500' } } });
      return new Response(JSON.stringify({ success: true, response: 123.45, costs: { paper: 20, total: -1 }, delais: 3, weight: 2.5, fournisseur: 'Atelier', total_process_duration: 12, all_process: [{ id: 1 }] }));
    });
    const gateway = new HttpClariprintQuoteGateway('lrdp.clariprint.com', 'login', 'password', fetchMock as unknown as typeof fetch);
    await expect(gateway.quote({ clariprint: { reference: 'FLYER', quantity: 500 } })).resolves.toMatchObject({ success: true, priceHT: 123.45, costs: { paper: 20 }, delais: 3, fournisseur: 'Atelier' });
    expect(fetchMock).toHaveBeenCalledWith('https://lrdp.clariprint.com/optimproject/json.wcl', expect.any(Object));
  });

  it('répond sans erreur serveur lorsque les identifiants manquent', async () => {
    const result = await new HttpClariprintQuoteGateway('https://clariprint.test', null, null).quote({ clariprint: {} });
    expect(result).toEqual({ success: false, credentialsMissing: true, message: 'Configuration Clariprint incomplète.' });
  });

  it('bloque les prix négatifs du fournisseur', async () => {
    const fetchMock = vi.fn(async () => Response.json({ success: true, response: -1.2 }));
    const result = await new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch).quote({ clariprint: {} });
    expect(result).toMatchObject({ success: false, error: 'Prix Clariprint invalide (négatif)' });
  });
});
