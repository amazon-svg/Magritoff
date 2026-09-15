/**
 * Preuves de mutation pour l inventaire fige de
 * `legacy-server-e3db71a4-app-inventory.test.ts` (qa-review round 3,
 * 2026-09-15) : RN1 a RN5 (drift de l inventaire lui-meme) et Q9 a Q12
 * (constructions Hono absentes aujourd hui : onError, all, route
 * parametree, chemin dynamique).
 *
 * Chaque `it` construit un inventaire MUTE a partir de la liste attendue
 * (`baseInventory()`) et verifie qu il ne correspond plus a la liste
 * attendue -- exactement ce que ferait `toEqual(EXPECTED_INVENTORY)` dans
 * le garde reel s il recevait ce inventaire.
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { buildAppInventory, type AppInventoryEntry } from './legacy-server-e3db71a4-app-inventory.test.ts';

const EXPECTED_INVENTORY: AppInventoryEntry[] = [
  { method: 'use', path: '*', argCount: 2 },
  { method: 'use', path: '/*', argCount: 2 },
  { method: 'get', path: '/make-server-e3db71a4/health', argCount: 2 },
  { method: 'get', path: '/make-server-e3db71a4/claude-test', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/claude-proxy', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/claude-proxy-stream', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/clariprint-quote', argCount: 2 },
  { method: 'get', path: '/make-server-e3db71a4/clariprint-test', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/save-product', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/send-invitation-email', argCount: 2 },
  { method: 'post', path: '/make-server-e3db71a4/category-editorial', argCount: 2 },
];

function inventoryOf(source: string): AppInventoryEntry[] {
  const file = ts.createSourceFile('mutation.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return buildAppInventory(file);
}

const BASE_ROUTES = `
app.use('*', logger(console.log));
app.use("/*", cors({ origin: "*" }));
app.get("/make-server-e3db71a4/health", (c) => c.json({ ok: true }));
app.get("/make-server-e3db71a4/claude-test", (c) => c.json({ ok: true }));
app.post("/make-server-e3db71a4/claude-proxy", (c) => c.json({ ok: true }));
app.post("/make-server-e3db71a4/claude-proxy-stream", (c) => c.json({ ok: true }));
app.post("/make-server-e3db71a4/clariprint-quote", (c) => c.json({ ok: true }, 410));
app.get("/make-server-e3db71a4/clariprint-test", (c) => c.json({ ok: true }, 410));
app.post("/make-server-e3db71a4/save-product", (c) => c.json({ ok: true }, 410));
app.post("/make-server-e3db71a4/send-invitation-email", (c) => c.json({ ok: true }, 410));
app.post("/make-server-e3db71a4/category-editorial", (c) => c.json({ ok: true }));
`;

describe('RN1 a RN5 (drift de l inventaire lui-meme)', () => {
  it('RN1 - route supplementaire non repertoriee', () => {
    const source = `${BASE_ROUTES}\napp.get("/make-server-e3db71a4/secret-debug", (c) => c.json({ leak: true }));\n`;
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('RN2 - middleware intercale change le nombre d arguments d une route', () => {
    const source = BASE_ROUTES.replace(
      'app.post("/make-server-e3db71a4/save-product", (c) => c.json({ ok: true }, 410));',
      'app.post("/make-server-e3db71a4/save-product", someMiddleware, (c) => c.json({ ok: true }, 410));',
    );
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('RN3 - chemin litteral legerement modifie sur une route existante', () => {
    const source = BASE_ROUTES.replace(
      '/make-server-e3db71a4/clariprint-quote',
      '/make-server-e3db71a4/clariprint-quote-v2',
    );
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('RN4 - methode changee pour un chemin existant (get au lieu de post)', () => {
    const source = BASE_ROUTES.replace(
      'app.post("/make-server-e3db71a4/save-product"',
      'app.get("/make-server-e3db71a4/save-product"',
    );
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('RN5 - reordonnancement de deux entrees (l inventaire est positionnel)', () => {
    const lines = BASE_ROUTES.trim().split('\n');
    const [a, b] = [lines[2], lines[3]];
    lines[2] = b;
    lines[3] = a;
    const source = lines.join('\n');
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });
});

describe('Q9 a Q12 (constructions Hono absentes aujourd hui)', () => {
  it('Q9 - app.onError ajoute', () => {
    const source = `${BASE_ROUTES}\napp.onError((err, c) => c.json({ raw: String(err) }));\n`;
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('Q10 - app.all ajoute', () => {
    const source = `${BASE_ROUTES}\napp.all("/make-server-e3db71a4/wildcard", (c) => c.json({ ok: true }));\n`;
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('Q11 - route a parametre ajoutee', () => {
    const source = `${BASE_ROUTES}\napp.get("/make-server-e3db71a4/product/:id", (c) => c.json({ ok: true }));\n`;
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });

  it('Q12 - chemin en template literal AVEC substitution (route dynamique)', () => {
    const source = BASE_ROUTES.replace(
      'app.get("/make-server-e3db71a4/health", (c) => c.json({ ok: true }));',
      'const seg = "health"; app.get(`/make-server-e3db71a4/${seg}`, (c) => c.json({ ok: true }));',
    );
    expect(inventoryOf(source)).not.toEqual(EXPECTED_INVENTORY);
  });
});

describe('non-regression : l inventaire de base correspond exactement a la liste attendue', () => {
  it('BASE_ROUTES sans mutation est conforme', () => {
    expect(inventoryOf(BASE_ROUTES)).toEqual(EXPECTED_INVENTORY);
  });
});
