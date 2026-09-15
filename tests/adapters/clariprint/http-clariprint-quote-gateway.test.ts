import { describe, expect, it, vi } from 'vitest';
import { HttpClariprintQuoteGateway } from '@/adapters/clariprint/http-clariprint-quote-gateway';
import type { ClariprintQuoteLogEntry } from '@/modules/clariprint/application/clariprint-quote-logger';

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
    const result = await gateway.quote({ clariprint: { reference: 'FLYER', quantity: 500 } });
    expect(result).toMatchObject({ success: true, priceHT: 123.45, costs: { paper: 20 }, delais: 3, fournisseur: 'Atelier' });
    // Correctif sécurité 2026-09-15 (mutation M10 survivante) : `toMatchObject`
    // ne verifie pas l absence de proprietes en trop ; sans le `delete
    // costs.total` sur un total invalide, `costs.total: -1` (negatif)
    // traverserait quand meme le `toMatchObject` ci-dessus.
    expect(result.costs).not.toHaveProperty('total');
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
    expect(result).toEqual({ success: false, error: 'Prix Clariprint invalide (négatif)' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_NEG_ALLPROC_1');
    expect(serialized).not.toContain('W_NEG_ALLPROC_2');
    expect(serialized).not.toContain('W_NEG_FAULTY_1');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    // BCP-1a : plus aucun extrait de reponse (`priceHT brut recu: -1.2`) dans
    // la reponse publique — il n'existait qu'au verdict journalise.
    expect(result).not.toHaveProperty('details');
  });

  it('bloque les prix non numeriques du fournisseur sans laisser fuir le detail interne des gammes', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      response: 'not-a-number',
      all_process: [{ printer: 'W_NAN_ALLPROC_1', external_id: 'W_NAN_ALLPROC_2' }],
      all_faulty_process: { gamme_offset: 'W_NAN_FAULTY_1' },
    }));
    const result = await new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch).quote({ clariprint: {} });
    expect(result).toEqual({ success: false, error: 'Prix Clariprint invalide (absent, NaN ou non-numérique)' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_NAN_ALLPROC_1');
    expect(serialized).not.toContain('W_NAN_ALLPROC_2');
    expect(serialized).not.toContain('W_NAN_FAULTY_1');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    expect(result).not.toHaveProperty('details');
  });

  // BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) : une exception reseau
  // (`fetch` qui rejette) porte SOUVENT L'HOTE dans son message
  // (`getaddrinfo ENOTFOUND badhost.clariprint.invalid`, etc.). Avant ce
  // lot, `details: error.message.slice(0, 500)` le recopiait tel quel vers
  // l'appelant anonyme de cette route publique — dette qa de BCP-0, fermee
  // ici : ni l'hote, ni aucun texte d'exception ne sortent.
  it("ne laisse jamais fuir l hote ni le texte de l exception reseau vers l appelant", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND badhost.clariprint.invalid');
    });
    const gateway = new HttpClariprintQuoteGateway('https://badhost.clariprint.invalid', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    expect(result).toEqual({ success: false, error: 'Connexion Clariprint impossible' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('badhost.clariprint.invalid');
    expect(serialized).not.toContain('getaddrinfo');
    expect(result).not.toHaveProperty('details');
  });

  // Correctif sécurité 2026-09-15 : `all_process` (déjà présent dans le
  // fixture précédente sous `all_faulty_process` seul) est ajouté ici pour
  // couvrir le chemin `success:false` avec les DEUX champs de detail interne.
  // BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) : avant ce lot,
  // `error: typeof payload.error === 'string' ? payload.error : ...`
  // recopiait le texte brut d'erreur de Clariprint tel quel vers l'appelant
  // anonyme de cette route publique. Il est desormais generique ; le texte
  // brut ne va qu'au verdict journalise (teste plus bas via un logger espion).
  it('ne transmet jamais le detail interne des gammes ni le texte brut de Clariprint en cas d echec fournisseur', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      success: false,
      error: 'Configuration produit refusee W_UPSTREAM_ERROR_TEXT_1',
      all_process: [{ printer: 'W_FALSE_ALLPROC_1' }],
      all_faulty_process: { gamme_offset: 'FaultySecretDEF' },
    }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('FaultySecretDEF');
    expect(serialized).not.toContain('W_FALSE_ALLPROC_1');
    expect(serialized).not.toContain('W_UPSTREAM_ERROR_TEXT_1');
    expect(result).toEqual({ success: false, error: 'Erreur de calcul Clariprint' });
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    expect(result).not.toHaveProperty('details');
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

  // BCP-1a (docs/api/CONVENTIONS.md §8.25 point 2.3) : avant ce lot, le corps
  // brut de la réponse était repris tronqué dans `details`
  // (`text.slice(0, 500)`) — un extrait de réponse au sens du cadrage, donc
  // interdit vers l'appelant anonyme. Il ne va plus qu'au verdict
  // journalisé (testé plus bas via un logger espion) ; ce test vérifie
  // qu'aucun champ structuré ni aucun extrait brut ne fuit sur ce chemin.
  it('ne laisse fuir aucun detail interne ni extrait de reponse sur une reponse HTTP non-OK', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      response: 42,
      all_process: [{ printer: 'W_NONOK_ALLPROC_1' }],
      all_faulty_process: { gamme_offset: 'W_NONOK_FAULTY_1' },
    }), { status: 500 }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    expect(result).toEqual({ success: false, error: 'Clariprint injoignable ou en erreur' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_NONOK_ALLPROC_1');
    expect(serialized).not.toContain('W_NONOK_FAULTY_1');
    expect(result).not.toHaveProperty('costs');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    expect(result).not.toHaveProperty('priceHT');
    expect(result).not.toHaveProperty('details');
  });

  // BCP-1a : même réserve que ci-dessus sur le contenu brut de `details`
  // (`text.slice(0, 300)`), désormais fermée.
  it('ne laisse fuir aucun detail interne ni extrait de reponse sur une reponse non-JSON', async () => {
    const fetchMock = vi.fn(async () => new Response('all_process contains W_NONJSON_ALLPROC_1 but this is not JSON {'));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch);
    const result = await gateway.quote({ clariprint: {} });
    expect(result).toEqual({ success: false, error: 'Réponse Clariprint invalide (non-JSON)' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('W_NONJSON_ALLPROC_1');
    expect(result).not.toHaveProperty('costs');
    expect(result).not.toHaveProperty('allResults');
    expect(result).not.toHaveProperty('faultyProcess');
    expect(result).not.toHaveProperty('priceHT');
    expect(result).not.toHaveProperty('details');
  });
});

// ============================================================================
// BCP-1a — le verdict journalisé (docs/api/CONVENTIONS.md §8.25 point 2.3).
// ============================================================================
describe('HttpClariprintQuoteGateway — verdict journalisé', () => {
  function spyLogger() {
    const entries: ClariprintQuoteLogEntry[] = [];
    return { logger: { log: (entry: ClariprintQuoteLogEntry) => entries.push(entry) }, entries };
  }

  it('journalise un succes avec outcome=priced, le requestId fourni, et n appelle jamais le logger avant la reponse', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => Response.json({ success: true, response: 12.5 }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: { quantity: 10 } }, 'req-priced-1');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ event: 'clariprint.quote', requestId: 'req-priced-1', outcome: 'priced' });
    expect(entries[0]?.verdict.upstreamSuccess).toBe(true);
    expect(entries[0]?.verdict.rawResponseValue).toBe('12.5');
  });

  it('journalise not_priced sur un refus Clariprint (success:false), avec le texte amont tronque DANS LE VERDICT SEULEMENT', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => Response.json({ success: false, error: 'Configuration produit refusee' }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: {} }, 'req-not-priced-1');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe('not_priced');
    expect(entries[0]?.verdict.upstreamError).toBe('Configuration produit refusee');
  });

  it('journalise not_priced sur un prix invalide (succes amont mais prix negatif)', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => Response.json({ success: true, response: -3 }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: {} }, 'req-invalid-price');
    expect(entries[0]).toMatchObject({ outcome: 'not_priced' });
    expect(entries[0]?.verdict.rawResponseValue).toBe('-3');
  });

  // qa-review round 1 (REJET, ÉLEVÉ) — test INVERSÉ : il exigeait AVANT
  // l'hôte dans le verdict. Il exige maintenant son ABSENCE, categorie
  // `'network'`, et `upstreamError`/`errorClass` a `null` (aucun
  // `payload.error` n'existe sur ce chemin, puisqu'aucune reponse n'a ete
  // recue).
  it("ne journalise JAMAIS l hote ni le texte de l exception reseau — seule la categorie 'network' est conservee", async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => { throw new TypeError('fetch failed: getaddrinfo ENOTFOUND badhost.clariprint.invalid'); });
    const gateway = new HttpClariprintQuoteGateway('https://badhost.clariprint.invalid', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: {} }, 'req-unavailable-network');
    expect(entries[0]).toMatchObject({ outcome: 'unavailable' });
    expect(entries[0]?.verdict.failureCategory).toBe('network');
    expect(entries[0]?.verdict.upstreamError).toBeNull();
    expect(entries[0]?.verdict.errorClass).toBeNull();
    expect(entries[0]?.verdict.upstreamStatus).toBeNull();
    const serialized = JSON.stringify(entries[0]);
    expect(serialized).not.toContain('badhost.clariprint.invalid');
    expect(serialized).not.toContain('getaddrinfo');
  });

  // qa-review round 1 (ÉLEVÉ) — sonde qa : « une réponse 500 dont le corps
  // reprend les paramètres envoyés fait arriver LOGIN_TEMOIN, MDP_TEMOIN et
  // du HTML au journal ». Ce test pose ces temoins dans le corps non-OK ET
  // dans le corps non-JSON, puis verifie leur absence totale du JOURNAL
  // (serialisation des appels au logger), pas seulement de la reponse.
  it('ne journalise JAMAIS le corps brut (login/mot de passe/HTML reflechis) sur un HTTP non-OK ni sur une reponse non-JSON', async () => {
    const { logger, entries } = spyLogger();
    const httpErrorFetch = vi.fn(async () => new Response(
      '<html><body>login=LOGIN_TEMOIN&password=MDP_TEMOIN</body></html>',
      { status: 503 },
    ));
    await new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', httpErrorFetch as unknown as typeof fetch, logger).quote({ clariprint: {} }, 'req-http-error');
    expect(entries[0]).toMatchObject({ outcome: 'unavailable' });
    expect(entries[0]?.verdict.failureCategory).toBe('http_status');
    expect(entries[0]?.verdict.upstreamStatus).toBe(503);
    expect(entries[0]?.verdict.upstreamError).toBeNull();

    const nonJsonFetch = vi.fn(async () => new Response('login=LOGIN_TEMOIN&password=MDP_TEMOIN not json'));
    await new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', nonJsonFetch as unknown as typeof fetch, logger).quote({ clariprint: {} }, 'req-non-json');
    expect(entries[1]).toMatchObject({ outcome: 'unavailable' });
    expect(entries[1]?.verdict.failureCategory).toBe('non_json');
    expect(entries[1]?.verdict.upstreamError).toBeNull();

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain('LOGIN_TEMOIN');
    expect(serialized).not.toContain('MDP_TEMOIN');
    expect(serialized).not.toContain('<html>');
  });

  it('journalise not_configured quand les identifiants sont absents, sans appeler fetch', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn();
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test', null, null, fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: {} }, 'req-not-configured');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(entries).toEqual([
      expect.objectContaining({ event: 'clariprint.quote', requestId: 'req-not-configured', outcome: 'not_configured' }),
    ]);
  });

  it('expurge all_faulty_process dans le verdict (ordinal, jamais le nom reel de l imprimeur) et compte all_process sans le reproduire', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => Response.json({
      success: true,
      response: 5,
      all_process: [{ printer: 'ImprimeurReelSecret1' }, { printer: 'ImprimeurReelSecret2' }],
      all_faulty_process: { ImprimeurReelSecret3: 'raison du refus' },
    }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: {} }, 'req-expurge');
    const verdict = entries[0]?.verdict;
    expect(verdict?.allProcessCount).toBe(2);
    expect(verdict?.allFaultyProcess).toEqual([{ printer: 'imprimeur_1', detail: 'raison du refus' }]);
    const serializedVerdict = JSON.stringify(verdict);
    expect(serializedVerdict).not.toContain('ImprimeurReelSecret1');
    expect(serializedVerdict).not.toContain('ImprimeurReelSecret2');
    expect(serializedVerdict).not.toContain('ImprimeurReelSecret3');
  });

  // Arbitrage architecte (qa-review de d8a0a57b, point (3)) : `payload.error`
  // peut nommer un imprimeur du parc — il est admis au journal APRES
  // substitution par l ordinal, jamais tel quel.
  it('substitue le nom d imprimeur present dans payload.error avant de le journaliser', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => Response.json({
      success: false,
      error: 'Aucun papier disponible chez ImprimerieSecreteDuParc pour cette gamme',
      all_process: [{ printer: 'ImprimerieSecreteDuParc' }],
    }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({ clariprint: {} }, 'req-substitution');
    expect(entries[0]?.verdict.upstreamError).toBe('Aucun papier disponible chez imprimeur_1 pour cette gamme');
    expect(entries[0]?.verdict.errorClass).toBe('unclassified');
    expect(JSON.stringify(entries[0])).not.toContain('ImprimerieSecreteDuParc');
  });

  it('expurge reference et address de la charge envoyee dans le verdict, mais garde le reste', async () => {
    const { logger, entries } = spyLogger();
    const fetchMock = vi.fn(async () => Response.json({ success: true, response: 5 }));
    const gateway = new HttpClariprintQuoteGateway('https://clariprint.test/optimproject/json.wcl', 'l', 'p', fetchMock as unknown as typeof fetch, logger);
    await gateway.quote({
      clariprint: {
        reference: 'Devis pour Mme Personne Secrete',
        quantity: 500,
        deliveries: { d_livraison: { iso: 'FR-75', address: '12 rue Secrete', quantity: 500 } },
      },
    }, 'req-sent-config');
    const sentConfig = entries[0]?.verdict.sentConfig;
    expect(sentConfig).not.toHaveProperty('reference');
    expect((sentConfig?.deliveries as Record<string, unknown>)?.d_livraison).not.toHaveProperty('address');
    expect(sentConfig?.quantity).toBe('500');
    const serialized = JSON.stringify(sentConfig);
    expect(serialized).not.toContain('Personne Secrete');
    expect(serialized).not.toContain('rue Secrete');
  });
});
