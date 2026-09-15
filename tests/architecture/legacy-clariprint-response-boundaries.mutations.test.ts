/**
 * Preuves de mutation pour le garde AST structurel de
 * `legacy-clariprint-response-boundaries.test.ts` (qa-review 2026-09-15,
 * rejet du garde v2 -- 25 contournements survivaient encore, y compris ceux
 * qui avaient motive le garde v2 : liste noire d identifiants, resolution
 * d alias "triviaux". Le garde v3 abandonne la liste noire pour une liste
 * blanche structurelle -- voir l en-tete de legacy-clariprint-response-boundaries.test.ts).
 *
 * Chaque `it` ci-dessous projette UNE mutation dans un mini fichier source
 * autonome (meme squelette `app.post`/`app.get` + import des `build*`) et
 * verifie que `findLegacyClariprintResponseViolations` la detecte. Chaque
 * test "tue" sa mutation en la faisant echouer si le garde ne la voit pas.
 */
import { describe, expect, it } from 'vitest';
import { findLegacyClariprintResponseViolations } from './legacy-clariprint-response-boundaries.test.ts';

const IMPORTS = `import {
  buildAuthTestBody,
  buildQuoteCalcErrorBody,
  buildQuoteCredentialsMissingBody,
  buildQuoteHttpErrorBody,
  buildQuoteInvalidJsonBody,
  buildQuoteInvalidPriceBody,
  buildQuoteMissingProductBody,
  buildQuoteServerErrorBody,
  buildQuoteSuccessBody,
} from "./clariprint-responses.ts";
`;

function quoteHandler(body: string): string {
  return `${IMPORTS}
app.post("/make-server-e3db71a4/clariprint-quote", async (c) => {
  const login = "x";
  const host = "x";
  const apiUrl = "x";
  let result: any = { response: 1 };
  let responseText = "{}";
  let errorText = "boom";
${body}
});
`;
}

function testHandler(body: string): string {
  return `${IMPORTS}
app.get("/make-server-e3db71a4/clariprint-test", async (c) => {
  const host = "x";
  const login = "x";
  let rawText = "{}";
  const httpStatus = 200;
${body}
});
`;
}

const VALID_SUCCESS_ARG = `{ priceHT: result.response, costs: result.costs, delais: result.delais, weight: result.weight, fournisseur: result.fournisseur, processDuration: result.total_process_duration }`;

function violations(source: string) {
  return findLegacyClariprintResponseViolations('mutation.ts', source);
}

describe('les 5 indirections (garde v2 rejete -- une liste noire d identifiants ne suffit pas)', () => {
  it('indirection 1 - alias a deux niveaux : const a = result; const b = a', () => {
    const source = quoteHandler(`
  const a = result;
  const b = a;
  return c.json(buildQuoteCalcErrorBody(b));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('indirection 2 - fonction locale flechee : const getX = () => result.error', () => {
    const source = quoteHandler(`
  const getX = () => result.error;
  return c.json(buildQuoteCalcErrorBody(getX()));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('indirection 3 - fonction locale declaree : function getX() { return result.error; }', () => {
    const source = quoteHandler(`
  function getX() { return result.error; }
  return c.json(buildQuoteCalcErrorBody(getX()));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('indirection 4 - Object.assign via une variable', () => {
    const source = quoteHandler(`
  const merged = Object.assign({}, result);
  return c.json(buildQuoteCalcErrorBody(merged));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('indirection 5 - JSON.parse(JSON.stringify(result)) via une variable', () => {
    const source = quoteHandler(`
  const clone = JSON.parse(JSON.stringify(result));
  return c.json(buildQuoteCalcErrorBody(clone));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });
});

describe('N6 a N15 (rejet garde v2, 25 contournements survivants)', () => {
  it('N6 - costs: result.all_process (mapping errone dans le corps succes)', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody({ priceHT: result.response, costs: result.all_process, delais: result.delais, weight: result.weight, fournisseur: result.fournisseur, processDuration: result.total_process_duration }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N7 - priceHT: result.error (mapping errone, mauvaise propriete source)', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody({ priceHT: result.error, costs: result.costs, delais: result.delais, weight: result.weight, fournisseur: result.fournisseur, processDuration: result.total_process_duration }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N8 - cle non autorisee ajoutee au corps succes (allResults)', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody({ priceHT: result.response, costs: result.costs, delais: result.delais, weight: result.weight, fournisseur: result.fournisseur, processDuration: result.total_process_duration, allResults: result.all_process }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N9 - cle manquante dans le corps succes (weight omis)', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody({ priceHT: result.response, costs: result.costs, delais: result.delais, fournisseur: result.fournisseur, processDuration: result.total_process_duration }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N10 - identifiant parsed passe a un constructeur non exempte', () => {
    const source = testHandler(`
  let parsed: any = { success: true };
  return c.json(buildAuthTestBody({ success: true, message: parsed }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N11 - variable de catch (err) passee a buildQuoteServerErrorBody', () => {
    const source = quoteHandler(`
  try {
    JSON.parse(responseText);
  } catch (err) {
    return c.json(buildQuoteServerErrorBody(err as any));
  }
  return c.json(buildQuoteServerErrorBody());
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N12 - fuite par en-tete : c.header avant le c.json conforme', () => {
    const source = quoteHandler(`
  c.header("X-Debug-Raw", JSON.stringify(result));
  return c.json(buildQuoteCalcErrorBody());
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N13 - sortie via new Response au lieu de c.json', () => {
    const source = quoteHandler(`
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N14 - chemin de route en gabarit template literal (garde rendu vacant)', () => {
    const source = `${IMPORTS}
app.post(\`/make-server-e3db71a4/clariprint-quote\`, async (c) => {
  return c.json(result);
});
`;
    // Le garde doit TROUVER ce handler (sinon 0 violation par vacuite) ET y
    // relever le c.json(result) direct.
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('N15 - 2e argument de c.json non litteral (statut dynamique)', () => {
    const source = quoteHandler(`
  const status = 500;
  return c.json(buildQuoteCalcErrorBody(), status);
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });
});

describe('non-regression : code conforme, zero violation', () => {
  it('un appel build* sans argument est conforme', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteCalcErrorBody());
`);
    expect(violations(source)).toEqual([]);
  });

  it('un appel build* avec un unique argument litteral est conforme', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteCredentialsMissingBody("Configurez les secrets."), 200);
`);
    expect(violations(source)).toEqual([]);
  });

  it('buildQuoteSuccessBody avec le mapping exact des 6 cles est conforme', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody(${VALID_SUCCESS_ARG}));
`);
    expect(violations(source)).toEqual([]);
  });

  it('buildAuthTestBody avec success/httpStatus est conforme (pas de faux positif)', () => {
    const source = testHandler(`
  const success = true;
  return c.json(buildAuthTestBody({ success, message: success ? "ok" : \`echec HTTP \${httpStatus}\` }));
`);
    expect(violations(source)).toEqual([]);
  });

  it('un statut HTTP litteral en 2e argument de c.json est conforme', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteMissingProductBody(), 400);
`);
    expect(violations(source)).toEqual([]);
  });
});
