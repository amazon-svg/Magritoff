/**
 * `stripComments` est devenu le point unique de defaillance de TOUS les
 * gardes textuels du chantier E10 : si cette fonction laisse passer une forme
 * de commentaire, les quatre gardes qui l importent tombent ensemble, en
 * silence, exactement comme cela s est produit quatre fois.
 *
 * Les cas ci-dessous ne sont pas hypothetiques : chacun est une forme qui a
 * REELLEMENT ete exploitee par la qa-review contre une version precedente, ou
 * un faux positif qui a REELLEMENT casse un garde avec un diagnostic
 * trompeur. Ils sont ecrits ici pour qu une regression les rejoue.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripComments, countComments } from './stripComments';

const NEEDLE = 'canAddAsIs(product, clariprintQuote)';
const root = resolve(__dirname, '../..');

describe('stripComments — les formes qui ont defait les versions precedentes', () => {
  it('retire un commentaire de ligne en FIN de ligne (a defait la version 2)', () => {
    expect(stripComments(`const x = true; // ${NEEDLE}`)).not.toContain(NEEDLE);
  });

  it('retire un commentaire de bloc en FIN de ligne (a defait la version 3)', () => {
    expect(stripComments(`const x = true; /* ${NEEDLE} */`)).not.toContain(NEEDLE);
  });

  it('retire un bloc COLLE a une virgule, sans blanc avant (a defait la version 4)', () => {
    expect(stripComments(`const x = true,/* ${NEEDLE} */`)).not.toContain(NEEDLE);
  });

  it('retire un bloc COLLE a une parenthese ouvrante (a defait la version 4)', () => {
    expect(stripComments(`{true ? (/* ${NEEDLE} */`)).not.toContain(NEEDLE);
  });

  it('retire un commentaire JSX {/* ... */}', () => {
    expect(stripComments(`<div>{/* ${NEEDLE} */}</div>`)).not.toContain(NEEDLE);
  });

  it('retire un bloc multi-lignes sans coller les lignes de code entre elles', () => {
    const out = stripComments(`const a = 1;\n/* ${NEEDLE}\n   suite */\nconst b = 2;`);
    expect(out).not.toContain(NEEDLE);
    // Sans preservation des sauts de ligne, `const b = 2;` se retrouverait sur
    // la meme ligne que `const a = 1;` et tout garde borne par ligne mentirait.
    expect(out.split('\n')).toHaveLength(4);
  });

  it('preserve les decalages du fichier, dont dependent les gardes bornes par fenetre', () => {
    const src = `const x = true; /* ${NEEDLE} */ const y = 2;`;
    expect(stripComments(src)).toHaveLength(src.length);
  });
});

describe('stripComments — ce qui ne doit PAS etre retire', () => {
  it('ne mange pas le code apres un attribut contenant `image/*` (faux positif reel, version 3)', () => {
    // C est ce faux positif qui avait motive l ancrage de la regle de bloc, et
    // donc, indirectement, les deux trous suivants. Le lexer le regle : un
    // `/*` dans une CHAINE n est pas un commentaire.
    const out = stripComments('<input data-accept="image/*" />\ndisabled={state.disabled}');
    expect(out).toContain('disabled={state.disabled}');
  });

  it('ne mange pas une URL `https://`', () => {
    expect(stripComments('const u = "https://exemple.fr/a";')).toContain('https://exemple.fr/a');
  });

  it('ne confond pas une division suivie d un commentaire avec une expression reguliere', () => {
    expect(stripComments('const r = a / b; /* note */\nconst z = 2;')).toContain('const z = 2');
  });

  it('ne mange pas une expression reguliere litterale contenant `/*`', () => {
    expect(stripComments('const re = /\\/\\*[a-z]*\\*\\//g;\nconst z = 3;')).toContain('const z = 3');
  });

  it('ne mange pas un gabarit de chaine contenant `/* */`', () => {
    expect(stripComments('const t = `a /* pas un commentaire */ b`;\nconst z = 4;')).toContain(
      'const z = 4',
    );
  });
});

describe('stripComments — sur les VRAIS fichiers du depot, pas seulement des extraits', () => {
  // C est la verification qui manquait, et son absence a coute un round
  // complet. La version au `ts.createScanner` passait tous les cas ci-dessus
  // — ecrits a la main, donc courts — et echouait sur un fichier reel : le
  // backtick de FIN d un `className={`...`}` pris pour un DEBUT de gabarit,
  // un token de 9 792 caracteres, et tous les commentaires au-dela intacts.
  // Un extrait de trois lignes ne pouvait pas le montrer. Un fichier de 50 ko
  // le montre immediatement.
  const FICHIERS = [
    'src/modules/catalog/ui/storefront/ShopProductCard.tsx',
    'src/modules/shops/ui/storefront/PublicShop.tsx',
    'src/modules/orders/ui/storefront/PortalCart.tsx',
    'src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts',
  ];

  it.each(FICHIERS)('ne laisse AUCUN commentaire dans %s', (relPath) => {
    const source = readFileSync(resolve(root, relPath), 'utf-8');
    // Garde-fou : si le fichier ne contenait aucun commentaire, l assertion
    // suivante serait vraie sans rien prouver.
    expect(countComments(source)).toBeGreaterThan(0);
    expect(countComments(stripComments(source))).toBe(0);
  });

  it.each(FICHIERS)('retire une aiguille injectee A LA FIN de %s', (relPath) => {
    // ORACLE NON CIRCULAIRE, et c est tout l objet de ce test.
    //
    // L assertion ci-dessus utilise `countComments`, qui partage son
    // mecanisme avec `stripComments` : meme `createSourceFile`, meme parcours
    // d arbre. Un commentaire que ce parcours ne verrait pas serait laisse par
    // l une ET compte zero par l autre — la verification prouverait seulement
    // sa propre coherence. C est la deuxieme fois dans ce chantier qu un
    // controle tourne en rond ; une aiguille connue le rompt.
    //
    // La FIN du fichier n est pas un detail : la version au lexer echouait
    // precisement au-dela d un certain point, apres qu un gabarit mal analyse
    // eut avale 9 792 caracteres. Une aiguille placee au debut n aurait rien
    // vu. Celle-ci aurait fait rougir ce test immediatement.
    const source = readFileSync(resolve(root, relPath), 'utf-8');
    const AIGUILLE = 'aiguille-de-controle-non-circulaire';
    for (const forme of [`\n// ${AIGUILLE}\n`, `\n/* ${AIGUILLE} */\n`, `\nconst z = 1; // ${AIGUILLE}\n`]) {
      expect(stripComments(source + forme)).not.toContain(AIGUILLE);
    }
    // Et la meme aiguille hors commentaire doit SURVIVRE : sans cela, un
    // nettoyeur qui supprimerait tout passerait ce test.
    expect(stripComments(`${source}\nconst t = "${AIGUILLE}";\n`)).toContain(AIGUILLE);
  });

  it('survit a un gabarit de chaine a substitution suivi de commentaires', () => {
    // La construction exacte qui a fait derailler la version 5.
    const src = [
      'const cls = `px-2 ${actif ? "on" : "off"} py-1`;',
      'const x = 1; // marqueur-de-ligne',
      'const y = 2; /* marqueur-de-bloc */',
    ].join('\n');
    const out = stripComments(src);
    expect(out).not.toContain('marqueur-de-ligne');
    expect(out).not.toContain('marqueur-de-bloc');
    expect(countComments(out)).toBe(0);
  });
});

describe('stripComments — la limite du procede, epinglee pour qu on ne l oublie pas', () => {
  it('NE retire PAS une chaine canonique placee dans un attribut JSX', () => {
    // Limite ASSUMEE, pas un defaut a corriger : il n y a rien a retirer ici,
    // ce n est pas un commentaire. Aucun nettoyage ne fermera cette evasion.
    // Elle est deliberee, et un garde textuel ne protege que de l accidentel.
    // La reponse juste, quand elle est possible, est un test de COMPORTEMENT.
    const src = `<span data-guard="${NEEDLE}" />`;
    expect(stripComments(src)).toContain(NEEDLE);
  });
});
