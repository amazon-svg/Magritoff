/**
 * Retire les commentaires d un source TypeScript / TSX avant de l epingler
 * par du texte.
 *
 * POURQUOI CE FICHIER EXISTE. Cette fonction a ete reecrite A LA MAIN quatre
 * fois dans le chantier E10, et trois de ces copies etaient PLUS FAIBLES que
 * l originale. Chaque affaiblissement a ete exploite par la qa-review, et a
 * chaque fois avec la meme consequence : un garde vert pendant qu une regle
 * metier etait neutralisee.
 *
 *   Round 1 de Q14-a : aucun nettoyage. Un bloc entier commente passait.
 *   Durcissement du coordinateur : regle `//` ANCREE en debut de ligne.
 *     -> un commentaire de FIN de ligne passait. Neutralisait l arbitrage
 *        d Arnaud du 16/09 (tout produit redevenait ajoutable au panier,
 *        chiffre ou non) avec les 13 tests du garde VERTS.
 *   Correction du coordinateur : regle `//` desancree.
 *     -> la regle `/* *\/` restait ancree, un commentaire de BLOC en fin de
 *        ligne passait. MEME defaut, une ligne au-dessus. Demontre par la
 *        qa-review sur quatre gardes a la fois, dont celui que la correction
 *        precedente venait de reparer.
 *
 * La lecon n est pas « mieux ecrire la regex » : c est que ce nettoyage ne
 * doit exister QU UNE FOIS. D ou ce fichier. Ne le recopiez pas, importez-le.
 *
 * POURQUOI LA REGLE DE BLOC N EST PAS SIMPLEMENT `/\/\*[\s\S]*?\*\//g`.
 * C est ce qu ecrit `tests/architecture/order-status-single-source.test.ts`,
 * et c est juste POUR DU TYPESCRIPT. Sur du JSX, un attribut parfaitement
 * legitime comme `data-accept="image/*"` ouvre alors un faux commentaire qui
 * avale le code jusqu au prochain `*\/` — c est le faux positif qui avait
 * motive l ancrage, et l ancrage etait un mauvais remede a un vrai probleme.
 *
 * Le remede juste : exiger un ESPACE (ou un debut de ligne) avant `/*`. Un
 * commentaire de bloc en est toujours precede ; `image/*` ne l est jamais,
 * puisqu il suit une lettre. La regle couvre donc le debut de ligne ET la fin
 * de ligne, sans reouvrir le faux positif.
 *
 * LIMITE DECLAREE, plutot que promesse d exhaustivite : ceci reste une
 * analyse de texte, pas un parseur. Une chaine contenant ` /* ` litteralement,
 * ou une URL `https://` en milieu de code, sont les cas connus — le premier
 * n a jamais ete rencontre dans ce depot, le second est deja traite par
 * `[^:]`. Quand un garde peut etre remplace par un test de COMPORTEMENT, il
 * doit l etre : ce nettoyage n est qu un pis-aller, utile la ou rien d autre
 * n existe (le cablage JSX, faute de bibliotheque de rendu React dans ce
 * depot).
 */
export const stripComments = (source: string): string =>
  source
    // Commentaires JSX `{/* ... */}` : partout, ils sont deja delimites.
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    // Commentaires de bloc `/* ... */`, en debut comme en fin de ligne.
    // `(^|\s)` epargne `image/*` et consorts, qui suivent une lettre.
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1')
    // Commentaires de ligne `// ...`, en debut comme en fin de ligne.
    // `[^:]` epargne le `//` d une URL (`https://`).
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
