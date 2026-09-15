/**
 * Preuves de mutation pour le garde AST de
 * `legacy-removed-routes-boundaries.test.ts` (qa-review round 2, 2026-09-15) :
 * R3 (nom de parametre code en dur), R4 (argument accepte par
 * `buildRouteGoneBody`), R5 (middleware intercale dans `app.post`) et R5b
 * (inscription concurrente `app.use`/`app.on`).
 *
 * Chaque `it` projette UNE mutation dans un mini fichier source autonome
 * (import du module `removed-route-responses.ts` + squelette `app.post`) et
 * verifie que `findRemovedRouteViolations` la detecte.
 */
import { describe, expect, it } from 'vitest';
import { findRemovedRouteViolations } from './legacy-removed-routes-boundaries.test.ts';

const IMPORTS = `import { buildRouteGoneBody } from "./removed-route-responses.ts";\n`;

function violations(source: string) {
  return findRemovedRouteViolations('mutation.ts', source);
}

describe('R3 a R5b (rejet garde v1 des routes retirees, qa-review round 2)', () => {
  it('R3 - nom de parametre de contexte renomme (ctx au lieu de c) : c.req reste detecte', () => {
    const source = `${IMPORTS}
app.post("/make-server-e3db71a4/save-product", async (ctx) => {
  const body = await ctx.req.json();
  return ctx.json(buildRouteGoneBody(), 410);
});
app.post("/make-server-e3db71a4/send-invitation-email", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('R4 - buildRouteGoneBody recoit un argument (fuite possible)', () => {
    const source = `${IMPORTS}
app.post("/make-server-e3db71a4/save-product", (c) => {
  return c.json(buildRouteGoneBody({ leaked: true } as any), 410);
});
app.post("/make-server-e3db71a4/send-invitation-email", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('R5 - middleware intercale entre le chemin et le handler', () => {
    const source = `${IMPORTS}
function suspiciousMiddleware(c: any, next: any) { return next(); }
app.post("/make-server-e3db71a4/save-product", suspiciousMiddleware, (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
app.post("/make-server-e3db71a4/send-invitation-email", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('R5b - inscription concurrente via app.use sur le meme chemin', () => {
    const source = `${IMPORTS}
app.use("/make-server-e3db71a4/save-product", async (c, next) => {
  console.log("effet de bord non revu");
  return next();
});
app.post("/make-server-e3db71a4/save-product", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
app.post("/make-server-e3db71a4/send-invitation-email", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });

  it('R5b bis - inscription concurrente via app.on sur un tableau de chemins', () => {
    const source = `${IMPORTS}
app.on("POST", ["/make-server-e3db71a4/send-invitation-email"], (c) => {
  return c.json({ ok: true });
});
app.post("/make-server-e3db71a4/save-product", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
app.post("/make-server-e3db71a4/send-invitation-email", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
`;
    expect(violations(source).length).toBeGreaterThan(0);
  });
});

describe('non-regression : code conforme, zero violation', () => {
  it('les deux routes conformes ne declenchent rien, et le middleware global legitime (app.use("*", ...)) n est pas un faux positif', () => {
    const source = `${IMPORTS}
app.use("*", (c: any, next: any) => next());
app.use("/*", (c: any, next: any) => next());
app.post("/make-server-e3db71a4/save-product", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
app.post("/make-server-e3db71a4/send-invitation-email", (c) => {
  return c.json(buildRouteGoneBody(), 410);
});
`;
    expect(violations(source)).toEqual([]);
  });
});
