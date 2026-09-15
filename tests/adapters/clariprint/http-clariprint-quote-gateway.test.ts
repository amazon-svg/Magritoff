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

  // Correctif sécurité BCP-0 (complément 2026-09-15) : `costs` ne documente
  // que six nombres (JsonApi.txt) : `paper`, `print`, `makeready`,
  // `packaging`, `delivery`, `total`. Un champ inconnu porté par Clariprint
  // - au niveau racine de la réponse OU à l'intérieur de `costs` - ne doit
  // jamais atteindre l'appelant anonyme de cette route publique. Ce test
  // échoue sur 461a1cca : `clariprintCostsSchema` y est encore
  // `.passthrough()` et `validCosts` y recopie toutes les clés reçues, donc
  // `printer`/`external_id` glissés dans `costs` fuient tels quels.
  it('ne laisse fuir aucun champ inconnu, ni a la racine ni dans costs', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      response: 50,
      champ_racine_inconnu: 'W_ROOT_UNKNOWN_1',
      costs: { paper: 8.09, print: 129.49, printer: 'W_COSTS_PRINTER_1', external_id: 'W_COSTS_EXTID_1' },
    }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_ROOT_UNKNOWN_1');
    expect(serialized).not.toContain('W_COSTS_PRINTER_1');
    expect(serialized).not.toContain('W_COSTS_EXTID_1');
    expect(result).toMatchObject({ success: true, priceHT: 50, costs: { paper: 8.09, print: 129.49 } });
    expect(result.costs).not.toHaveProperty('printer');
    expect(result.costs).not.toHaveProperty('external_id');
  });

  // Correctif sécurité 2026-09-15 (mutation M4e survivante) : la version
  // précédente de ce test n'incluait ni `all_process` ni
  // `all_faulty_process` dans sa réponse simulée, et vérifiait l'absence des
  // NOMS de clés (`all_process`) plutôt que d'une chaîne témoin de contenu -
  // un mutant qui aurait renommé/recopié le contenu sous une autre clé serait
  // passé inaperçu. On pose désormais des chaînes témoins dans le détail
  // interne des gammes et on vérifie leur absence par la valeur, pas par la
  // clé.
  it('bloque les prix négatifs du fournisseur sans laisser fuir le detail interne des gammes', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      response: -1.2,
      all_process: [{ printer: 'W_NEG_ALLPROC_1', external_id: 'W_NEG_ALLPROC_2' }],
      all_faulty_process: { gamme_offset: 'W_NEG_FAULTY_1' },
    }));
    const result = await new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch).quote({ clariprint: {} });
    expect(result).toMatchObject({ success: false, error: 'Prix Clariprint invalide (négatif)' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_NEG_ALLPROC_1');
    expect(serialized).not.toContain('W_NEG_ALLPROC_2');
    expect(serialized).not.toContain('W_NEG_FAULTY_1');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
  });

  it('bloque les prix non numeriques du fournisseur sans laisser fuir le detail interne des gammes', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      response: 'not-a-number',
      all_process: [{ printer: 'W_NAN_ALLPROC_1', external_id: 'W_NAN_ALLPROC_2' }],
      all_faulty_process: { gamme_offset: 'W_NAN_FAULTY_1' },
    }));
    const result = await new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch).quote({ clariprint: {} });
    expect(result).toMatchObject({ success: false, error: 'Prix Clariprint invalide (absent, NaN ou non-numérique)' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_NAN_ALLPROC_1');
    expect(serialized).not.toContain('W_NAN_ALLPROC_2');
    expect(serialized).not.toContain('W_NAN_FAULTY_1');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
  });

  // Correctif sécurité 2026-09-15 : `all_process` (déjà présent dans le
  // fixture précédente sous `all_faulty_process` seul) est ajouté ici pour
  // couvrir le chemin `success:false` avec les DEUX champs de detail interne.
  it('ne transmet jamais le detail interne des gammes en cas d echec fournisseur', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: false,
      error: 'Configuration produit refusee',
      all_process: [{ printer: 'W_FALSE_ALLPROC_1' }],
      all_faulty_process: { gamme_offset: 'FaultySecretDEF' },
    }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('FaultySecretDEF');
    expect(serialized).not.toContain('W_FALSE_ALLPROC_1');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
  });

  it('ne transmet jamais le detail interne des gammes en cas de succes', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      response: 123.45,
      all_process: [{ imprimeur: 'ImprimeurSecretXYZ', external_id: 'INT-999', cost: 12.3 }],
      all_faulty_process: { gamme_offset: 'FaultySecretABC' },
    }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('ImprimeurSecretXYZ');
    expect(serialized).not.toContain('INT-999');
    expect(serialized).not.toContain('FaultySecretABC');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
  });

  // Chemin HTTP non-OK : le corps brut de la réponse est repris tronqué dans
  // `details` (`text.slice(0, 500)`) — expurgation de `details`/`error` hors
  // périmètre BCP-0 (lot BCP-1a). Ce test vérifie ce qui EST du ressort de
  // BCP-0 : le detail interne des gammes n'est jamais reconstruit en champ
  // structuré (`costs`, `allResults`, `faultyProcess`) sur ce chemin. Si le
  // corps brut simulé tient dans les 500 premiers caractères, la chaîne
  // témoin reste visible dans `details` : c'est la dette BCP-1a documentée,
  // pas une régression de ce correctif.
  it('ne construit aucun champ structure de detail interne sur une reponse HTTP non-OK', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      response: 42,
      all_process: [{ printer: 'W_NONOK_ALLPROC_1' }],
      all_faulty_process: { gamme_offset: 'W_NONOK_FAULTY_1' },
    }), { status: 500 }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('costs');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    expect(result).not.toHaveProperty('priceHT');
  });

  // Chemin réponse non-JSON : même réserve BCP-1a que ci-dessus sur le
  // contenu brut de `details` (`text.slice(0, 300)`).
  it('ne construit aucun champ structure de detail interne sur une reponse non-JSON', async () => {
    const fetchMock = vi.fn(async () => new Response('all_process contains W_NONJSON_ALLPROC_1 but this is not JSON {'));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('costs');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    expect(result).not.toHaveProperty('priceHT');
  });
});
