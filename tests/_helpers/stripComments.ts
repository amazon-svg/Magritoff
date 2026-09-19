import ts from 'typescript';

/**
 * Retire les commentaires d un source TypeScript / TSX avant de l epingler
 * par du texte, EN LE FAISANT ANALYSER PAR TYPESCRIPT plutot qu en devinant.
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL A CHANGE D OUTIL DEUX FOIS.
 * Ce nettoyage a ete reecrit SIX fois dans le chantier E10, et cinq versions
 * etaient plus faibles que ce qu elles annoncaient. Chacune a ete mise en
 * defaut, chaque fois avec la meme consequence : un garde VERT pendant qu une
 * regle metier etait neutralisee.
 *
 *   1. aucun nettoyage              -> un bloc entier commente passait
 *   2. regle `//` ANCREE            -> `code(); // canAddAsIs(...)` passait
 *   3. `//` desancree, `/* *\/` ancree -> `code(); /* canAddAsIs(...) *\/` passait
 *   4. `(^|\s)` avant `/*`          -> `code(),/* ... *\/` et `(/* ... *\/` passaient
 *   5. `ts.createScanner` en boucle -> voir ci-dessous, le pire des cinq
 *
 * La version 5 est instructive et merite d etre racontee, parce qu elle avait
 * l air d etre la bonne reponse. Passer du texte au lexer etait juste dans son
 * principe : une regex ne sait pas ce qu est un commentaire, elle sait lui
 * ressembler. Mais un `scan()` appele en boucle ne suit NI le contexte JSX, NI
 * les gabarits de chaine a substitution (`` `... ${x} ...` ``). Sur
 * `OrderHistoryTable.tsx`, le backtick de FIN d un `className={`...`}` a donc
 * ete pris pour un DEBUT de gabarit : un seul token a avale 9 792 caracteres,
 * et tous les commentaires situes au-dela ont survecu intacts. Deux des trois
 * gardes de Q17-c retombaient, silencieusement — defaut trouve et signale par
 * le dev-story, qui a rejoue les mutations au lieu de se contenter du vert.
 *
 * La lecon : le lexer seul ne suffit pas, il faut le PARSEUR. `createSourceFile`
 * sait ce qu est du JSX et ce qu est un gabarit ; on lui demande ensuite ou
 * sont les commentaires, au lieu de les chercher soi-meme.
 *
 * Les commentaires sont remplaces par des ESPACES, pas supprimes : les
 * decalages du fichier restent valides, donc les gardes qui bornent leur
 * recherche a une fenetre (`indexOf` autour d un `data-testid`) visent
 * toujours la meme zone. Les sauts de ligne d un bloc multi-lignes sont
 * conserves, sans quoi deux lignes de code se retrouveraient collees.
 *
 * LIMITE REELLE, MESUREE, ET IRREDUCTIBLE PAR CE MOYEN. Retirer les
 * commentaires ne rend pas un garde textuel infaillible : la chaine cherchee
 * peut etre replacee dans le code sous une forme qui n est PAS un commentaire,
 * par exemple un attribut JSX —
 *
 *   <span data-guard="showsUnverifiedPriceBadge(o, appearance) && (" ...>
 *
 * Il n y a alors rien a retirer. C est la limite du PROCEDE, pas de cette
 * fonction : un garde textuel attrape la regression ACCIDENTELLE, celle qu un
 * developpeur ecrit en refactorant, et jamais l evasion deliberee. Quand une
 * decision peut etre extraite en fonction pure et testee sur son COMPORTEMENT,
 * elle doit l etre ; ce nettoyage n est qu un pis-aller, utile la ou rien
 * d autre n existe : le cablage JSX, faute de bibliotheque de rendu React
 * dans ce depot.
 */
export const stripComments = (source: string): string => {
  // `.tsx` sans condition : c est le sur-ensemble. Analyser du `.ts` comme du
  // TSX ne change rien aux commentaires, l inverse casserait tout le JSX.
  const sourceFile = ts.createSourceFile(
    'source.tsx',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const ranges = new Map<number, number>(); // debut -> fin
  const collect = (node: ts.Node): void => {
    for (const r of ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []) {
      ranges.set(r.pos, r.end);
    }
    for (const r of ts.getTrailingCommentRanges(source, node.getEnd()) ?? []) {
      ranges.set(r.pos, r.end);
    }
    for (const child of node.getChildren(sourceFile)) collect(child);
  };
  collect(sourceFile);

  const out = source.split('');
  for (const [start, end] of ranges) {
    for (let i = start; i < end; i += 1) {
      if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
    }
  }
  return out.join('');
};

/**
 * Nombre de commentaires que TypeScript trouve encore dans un source. Sert a
 * PROUVER qu un nettoyage est complet, plutot qu a le supposer : c est la
 * verification qui manquait a la version 5, dont l echec etait invisible
 * jusqu a ce qu on rejoue une mutation loin dans un gros fichier.
 */
export const countComments = (source: string): number => {
  const sourceFile = ts.createSourceFile(
    'source.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found = new Set<number>();
  const visit = (node: ts.Node): void => {
    for (const r of ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []) found.add(r.pos);
    for (const r of ts.getTrailingCommentRanges(source, node.getEnd()) ?? []) found.add(r.pos);
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  return found.size;
};
