/**
 * Preuves de mutation pour le garde AST de
 * `legacy-clariprint-response-boundaries.test.ts` (qa-review 2026-09-15,
 * rejet du premier filet de tests -- 12/14 mutations survivaient au garde
 * v1, qui ne cherchait que 4 identifiants litteraux).
 *
 * Chaque `it` ci-dessous projette UNE mutation dans un mini fichier source
 * autonome (meme squelette `app.post`/`app.get` + import des `build*`) et
 * verifie que `findLegacyClariprintResponseViolations` la detecte. Un test
 * qui ne detecterait pas sa mutation serait lui-meme rouge : chaque test
 * "tue" sa mutation en la faisant echouer.
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
${body}
});
`;
}

function violations(source: string) {
  return findLegacyClariprintResponseViolations('mutation.ts', source);
}

describe('mutations qui doivent faire echouer le garde (survivaient au garde v1)', () => {
  it('mutation 1 - destructuration renommee : const { all_process: gammes } = result', () => {
    const source = quoteHandler(`
  const { all_process: gammes } = result;
  return c.json(buildQuoteCalcErrorBody(gammes));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 2 - cle calculee : result["all" + "_process"]', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteCalcErrorBody(result["all" + "_process"]));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 3 - error: responseText.substring(0,300)', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteHttpErrorBody(responseText.substring(0, 300)));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 4 - errorText.substring(0,500)', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteHttpErrorBody(errorText.substring(0, 500)));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 5 - clariprint-test : ${login.substring(0,3)}*** dans le message', () => {
    const source = testHandler(`
  return c.json(buildAuthTestBody({ success: false, message: \`\${login.substring(0, 3)}***\` }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 6 - clariprint-test : ${host} dans le message', () => {
    const source = testHandler(`
  return c.json(buildAuthTestBody({ success: false, message: \`\${host}\` }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 7 - clariprint-test : rawText.substring dans le message', () => {
    const source = testHandler(`
  return c.json(buildAuthTestBody({ success: false, message: rawText.substring(0, 200) }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 8 - c.json(result) en direct', () => {
    const source = quoteHandler(`
  return c.json(result);
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 9 - spread {...result, ...buildQuoteSuccessBody()}', () => {
    const source = quoteHandler(`
  return c.json({ ...result, ...buildQuoteSuccessBody({ priceHT: result.response, costs: result.costs, delais: result.delais, weight: result.weight, fournisseur: result.fournisseur, processDuration: result.total_process_duration }) });
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 10 - variable intermediaire : const payload = result', () => {
    const source = quoteHandler(`
  const payload = result;
  return c.json(buildQuoteCalcErrorBody(payload));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 11 - buildQuoteSuccessBody avec une cle non autorisee', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody({ priceHT: result.response, allResults: result.all_process }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 12 - buildQuoteSuccessBody avec une valeur non lue directement sur result (double indirection)', () => {
    const source = quoteHandler(`
  const priceHT = result.response;
  return c.json(buildQuoteSuccessBody({ priceHT }));
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 13 - objet litteral direct au lieu d un appel build*', () => {
    const source = quoteHandler(`
  return c.json({ success: false, error: "Erreur de calcul Clariprint" });
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('mutation 14 - identifiant nu autre que result (ex. une variable renommee sans alias trivial detecte doit au moins etre couverte par la regle i quand ce n est pas un appel build*)', () => {
    const source = quoteHandler(`
  const notABuilder = buildQuoteCalcErrorBody();
  return c.json(notABuilder);
`);
    expect(violations(source).length).toBeGreaterThan(0);
  });
});

describe('non-regression : code conforme, zero violation', () => {
  it('un appel build* sans argument tainte ne declenche rien', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteCalcErrorBody());
`);
    expect(violations(source)).toEqual([]);
  });

  it('buildQuoteSuccessBody avec les 6 cles lues simplement sur result est conforme', () => {
    const source = quoteHandler(`
  return c.json(buildQuoteSuccessBody({ priceHT: result.response, costs: result.costs, delais: result.delais, weight: result.weight, fournisseur: result.fournisseur, processDuration: result.total_process_duration }));
`);
    expect(violations(source)).toEqual([]);
  });

  it('un booleen calcule (non alias trivial) passe a buildAuthTestBody n est pas un faux positif', () => {
    const source = testHandler(`
  const success = true;
  return c.json(buildAuthTestBody({ success, message: "ok" }));
`);
    expect(violations(source)).toEqual([]);
  });
});
