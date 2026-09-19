import ts from 'typescript';

/**
 * Retire les commentaires d un source TypeScript / TSX avant de l epingler
 * par du texte, EN UTILISANT LE LEXER DE TYPESCRIPT plutot qu une expression
 * reguliere.
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N EST PLUS UNE REGEX.
 * Ce nettoyage a ete reecrit a la main CINQ fois dans le chantier E10, et
 * quatre de ces versions etaient plus faibles que ce qu elles annoncaient.
 * Chacune a ete mise en defaut par la qa-review, chaque fois avec la meme
 * consequence : un garde VERT pendant qu une regle metier etait neutralisee.
 *
 *   1. Aucun nettoyage           -> un bloc entier commente passait.
 *   2. Regle `//` ANCREE         -> `code(); // canAddAsIs(...)` passait.
 *   3. Regle `//` desancree,
 *      regle `/* *\/` ancree     -> `code(); /* canAddAsIs(...) *\/` passait.
 *   4. `(^|\s)` avant `/*`       -> `code(),/* ... *\/` et `code((/* ... *\/`
 *                                   passaient (pas de blanc avant le `/*`).
 *
 * A chaque tour, la correction fermait la forme demontree et en laissait une
 * autre a cote. C est le signe qu on ne repare pas le bon objet : une regex
 * ne sait pas ce qu est un commentaire, elle ne sait que ressembler. Le lexer
 * de TypeScript, lui, le sait — et sait aussi distinguer un `/*` d un `/*`
 * contenu dans une chaine, ce qui etait le VRAI probleme derriere le faux
 * positif `data-accept="image/*"` que la version 3 essayait de soigner par un
 * ancrage.
 *
 * Les commentaires sont remplaces par des ESPACES, pas supprimes : les
 * decalages du fichier sont preserves, donc les gardes qui bornent leur
 * recherche a une fenetre (`indexOf` autour d un `data-testid`) continuent de
 * viser la meme zone.
 *
 * LIMITE REELLE, MESUREE, ET IRREDUCTIBLE PAR CE MOYEN. Retirer les
 * commentaires ne rend pas un garde textuel infaillible. La chaine cherchee
 * peut etre replacee dans le code sous une forme qui n est PAS un
 * commentaire, par exemple un attribut JSX :
 *
 *   <span data-guard="showsUnverifiedPriceBadge(o, appearance) && (" ...>
 *
 * Il n y a alors rien a retirer, et aucun nettoyage ne fermera cela. La
 * qa-review l a demontre, et c est la limite du procede, pas de cette
 * fonction : un garde textuel attrape la regression ACCIDENTELLE — celle
 * qu un developpeur ecrit en refactorant — et jamais l evasion deliberee.
 * Quand une decision peut etre extraite en fonction pure et testee sur son
 * COMPORTEMENT, elle doit l etre ; ce nettoyage n est qu un pis-aller, utile
 * la ou rien d autre n existe : le cablage JSX, faute de bibliotheque de
 * rendu React dans ce depot.
 */
export const stripComments = (source: string): string => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.JSX,
    source,
  );
  const out = source.split('');
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const kind = scanner.getToken();
    if (
      kind !== ts.SyntaxKind.SingleLineCommentTrivia &&
      kind !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    // Blanchir plutot que supprimer : les decalages restent valides. On
    // preserve les sauts de ligne d un commentaire multi-lignes, sans quoi
    // deux lignes de code se retrouveraient collees.
    for (let i = scanner.getTokenStart(); i < scanner.getTokenEnd(); i += 1) {
      if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
    }
  }
  return out.join('');
};
