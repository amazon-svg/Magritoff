/**
 * Moteur de rendu des modeles de notification (story E10.15a) — GRAMMAIRE
 * FERMEE, PAS un moteur de gabarit tiers (contrat §8.23 §5).
 *
 * DECISION, ET POURQUOI : la fiche suggerait « type Handlebars strict,
 * jamais de regex artisanale ». La seconde moitie est retenue INTEGRALEMENT,
 * la premiere ecartee — nous n avons besoin que d une SUBSTITUTION sur treize
 * identifiants connus (`NotificationTagId`), pas d un langage d expressions
 * (chemins, helpers, partials, sortie brute non echappee) dans un texte
 * ECRIT PAR UN TENANT et rendu cote serveur.
 *
 * LA GRAMMAIRE SE PROUVE : `{{` + un identifiant + `}}`, SANS ESPACE, SANS
 * VARIANTE. Rien d autre n est un jeton ; tout le reste est du texte
 * litteral, y COMPRIS une accolade isolee. Une variante comme `{order.number}`
 * (une seule accolade) n est PAS un jeton et traverse telle quelle ; une
 * variante comme `{{ order.number }}` (avec espaces) EST reconnue comme une
 * TENTATIVE de balise dont le contenu (` order.number `, espaces compris) ne
 * correspond a AUCUN identifiant connu — elle est donc refusee comme balise
 * INCONNUE (CA5), exactement le comportement que le contrat annonce
 * (« le validateur refusera » ces variantes), jamais un texte litteral
 * silencieux.
 *
 * UN SEUL BALAYAGE, JAMAIS DE RE-BALAYAGE D UNE VALEUR SUBSTITUEE. Le rendu
 * recopie les segments litteraux et ecrit les valeurs substituees dans une
 * chaine de sortie DISTINCTE du texte source ; une valeur substituee n est
 * ensuite jamais relue par le balayage (proprement qu un enchainement de
 * `String.replace()` successifs ne donne PAS : un client dont la raison
 * sociale contiendrait `{{order.number}}` littéralement obtiendrait alors un
 * numero de commande a la place de sa raison sociale au second passage).
 */

/** Une balise du texte n appartient pas a la liste blanche fournie pour l evenement du modele (CA5, 422 `notification_template.unknown_tag`). */
export class UnknownNotificationTagError extends Error {
  constructor(readonly tags: readonly string[]) {
    super(`Balise(s) inconnue(s) : ${tags.join(', ')}`);
    this.name = 'UnknownNotificationTagError';
  }
}

type TagSpan = Readonly<{ start: number; end: number; content: string }>;

/**
 * qa-review E10.15a round 1 (m1) — BALAYAGE A UN SEUL PASSAGE, ecrit comme un
 * AUTOMATE caractere par caractere (contrat §8.23 §5 : « a chaque `{{`, lit
 * jusqu au `}}` correspondant »), PAS une regex `[^{}]*` : celle-ci echouait
 * silencieusement des qu elle rencontrait une accolade a l interieur d une
 * tentative de balise (`{{ {{order.number}} }}`), et le moteur SAUTAIT
 * l ouverture externe pour ne retenir QUE la balise interne — livrant les
 * accolades externes au client (`{{ CDE-2026-00042 }}`) au lieu de refuser
 * le tout.
 *
 * Algorithme : a chaque `{{` rencontre, cherche le PREMIER `}}` qui suit
 * (`indexOf`), quel que soit ce qu il y a entre les deux — y COMPRIS une
 * autre paire `{{`/`}}`. Le `content` capture est donc, pour une balise
 * imbriquee, une chaine qui contient elle-meme des accolades : elle ne
 * correspondra JAMAIS a un `NotificationTagId` connu et sera donc refusee
 * comme balise INCONNUE par `assertKnownNotificationTags` — la balise
 * imbriquee est ainsi EXPLICITEMENT REFUSEE, jamais silencieusement
 * mal-parsee. Si aucun `}}` ne suit un `{{`, ce `{{` est du texte litteral
 * (meme comportement qu avant).
 *
 * PARTAGE entre extraction/validation ET rendu : les deux passent par CE
 * MEME balayage, pour que ce qui est REFUSE a l enregistrement soit
 * EXACTEMENT ce qui serait rendu — aucune divergence possible entre les deux
 * chemins.
 */
function scanNotificationTagSpans(text: string): readonly TagSpan[] {
  const spans: TagSpan[] = [];
  let i = 0;
  while (i < text.length - 1) {
    if (text[i] === '{' && text[i + 1] === '{') {
      const closeIndex = text.indexOf('}}', i + 2);
      if (closeIndex === -1) {
        // `{{` sans `}}` correspondant nulle part apres lui : texte
        // litteral. On avance d UN caractere (pas deux) pour laisser une
        // chance a un `{{` qui commencerait au caractere suivant.
        i += 1;
        continue;
      }
      spans.push({ start: i, end: closeIndex + 2, content: text.slice(i + 2, closeIndex) });
      i = closeIndex + 2;
    } else {
      i += 1;
    }
  }
  return spans;
}

/**
 * Extrait, dans l ORDRE d apparition et SANS DOUBLON, le contenu brut de
 * chaque jeton `{{...}}` du texte — qu il corresponde ou non a un identifiant
 * connu. Balayage a un seul passage (`scanNotificationTagSpans`, pas de
 * boucle de `String.replace`).
 */
export function extractNotificationTagTokens(text: string): readonly string[] {
  const found = new Set<string>();
  for (const span of scanNotificationTagSpans(text)) {
    found.add(span.content);
  }
  return [...found];
}

/**
 * Refuse le texte si au moins une balise n appartient pas a `allowedTags`
 * (comparaison EXACTE, sans trim : `order.number` seul est un jeton valide,
 * ` order.number ` — avec espaces — n en est pas un). Utilisee A
 * L ENREGISTREMENT du modele (create/update) ET a l apercu, JAMAIS au rendu
 * d envoi (hors perimetre de ce lot).
 */
export function assertKnownNotificationTags(text: string, allowedTags: ReadonlySet<string>): void {
  const unknown = extractNotificationTagTokens(text).filter((tag) => !allowedTags.has(tag));
  if (unknown.length > 0) throw new UnknownNotificationTagError(unknown);
}

/**
 * Rend le texte : chaque jeton CONNU (present dans `context`) est substitue
 * par sa valeur ; une balise dont la cle est ABSENTE de `context` rend une
 * CHAINE VIDE — jamais un tiret, jamais le nom de la balise (contrat §5).
 * Precondition implicite : le texte a deja passe `assertKnownNotificationTags`
 * (aucune balise inconnue) — cette fonction ne le revalide pas, elle se
 * contente de substituer ce qu elle trouve dans `context` et de laisser
 * passer tel quel ce qu elle n y trouve pas (defense supplementaire : un
 * appelant qui rendrait un texte non valide obtiendrait une chaine vide sur
 * la balise fautive, jamais une exception au rendu).
 */
export function renderNotificationTags(text: string, context: Readonly<Record<string, string>>): string {
  let output = '';
  let cursor = 0;
  for (const span of scanNotificationTagSpans(text)) {
    output += text.slice(cursor, span.start);
    output += context[span.content] ?? '';
    cursor = span.end;
  }
  output += text.slice(cursor);
  return output;
}

/**
 * RENDU DIFFERE (arbitrage architecte du 2026-09-12, §8.23 point 11) —
 * balises `render_stage: 'delivery'` (`files.count` SEULE aujourd hui),
 * arretees A LA REMISE plutot qu a la mise en file.
 *
 * PIEGE A NE PAS PRENDRE (point 11.1) : stocker le corps PARTIELLEMENT rendu
 * (balise differee laissee en clair) puis, A LA REMISE, RE-BALAYER ce corps
 * pour y substituer la balise violerait FRONTALEMENT la propriete du moteur
 * (« une valeur substituee n est jamais re-balayee ») — un client dont la
 * raison sociale contiendrait litteralement `{{files.count}}` verrait sa
 * raison sociale transformee en nombre au second passage.
 *
 * CE QUI EST FAIT A LA PLACE : le balayage UNIQUE (celui-ci, appele UNE SEULE
 * FOIS a la mise en file) produit DEUX sorties — le texte PROVISOIRE (balises
 * `enqueue` deja substituees, balises `deferred` LAISSEES EN CLAIR) ET la
 * liste des SEGMENTS (litteral | balise differee) qui permet, a la remise, de
 * RECONSTITUER le texte final par simple CONCATENATION (`joinDeferredSegments`,
 * ci-dessous) — JAMAIS un second balayage. Une occurrence de `{{files.count}}`
 * venue d une donnee CLIENT se trouve, par construction, A L INTERIEUR d un
 * segment LITTERAL (elle a ete recopiee telle quelle, comme tout texte
 * litteral) et ne peut donc JAMAIS etre resolue par `joinDeferredSegments`.
 */
export type RenderedSegment =
  | Readonly<{ kind: 'literal'; text: string }>
  | Readonly<{ kind: 'tag'; id: string }>;

/** Texte provisoire + segments, tel que STOCKE dans `notification_logs.deferred_render` (colonne INTERNE, jamais exposee par l API). */
export type DeferredRender = Readonly<{
  /** Segments litteraux + balises differees LAISSEES EN CLAIR — ce qui est ecrit dans `body`/`subject` tant que le message est `pending`. */
  text: string;
  segments: readonly RenderedSegment[];
}>;

/**
 * Forme PERSISTEE de `deferred_render` (jsonb) : `subject` est `null` sur un
 * modele `sms` (jamais de sujet) OU quand le sujet ne contenait AUCUNE balise
 * differee (segmente quand meme au meme titre que le corps, §8.23 point
 * 11.3 §2 : « appeler renderNotificationTagsWithDeferred pour le SUJET ET
 * pour le CORPS » — le resultat est un unique segment litteral si aucune
 * balise differee n y figure, ce qui est un cas legitime, pas une erreur) ;
 * `body` est TOUJOURS present quand `deferred_render` est non nul (`body`
 * n est jamais nul au contrat).
 */
export type DeferredRenderPayload = Readonly<{
  subject: readonly RenderedSegment[] | null;
  body: readonly RenderedSegment[];
}>;

/**
 * Balayage UNIQUE (meme automate que `renderNotificationTags`, MEME
 * `scanNotificationTagSpans` — aucune divergence possible entre les deux
 * chemins) : chaque balise appartenant a `deferred` est laissee EN CLAIR dans
 * `text` et devient un segment `{ kind: 'tag' }` ; toute autre balise (ou
 * texte litteral) est SUBSTITUEE/RECOPIEE immediatement et accumulee dans le
 * segment litteral COURANT.
 */
export function renderNotificationTagsWithDeferred(
  text: string,
  context: Readonly<Record<string, string>>,
  deferred: ReadonlySet<string>,
): DeferredRender {
  const segments: RenderedSegment[] = [];
  let output = '';
  let cursor = 0;
  let literalBuffer = '';

  const flushLiteral = (): void => {
    if (literalBuffer.length > 0) {
      segments.push({ kind: 'literal', text: literalBuffer });
      literalBuffer = '';
    }
  };

  for (const span of scanNotificationTagSpans(text)) {
    literalBuffer += text.slice(cursor, span.start);
    output += text.slice(cursor, span.start);

    if (deferred.has(span.content)) {
      flushLiteral();
      segments.push({ kind: 'tag', id: span.content });
      // Laissee EN CLAIR (`{{files.count}}`, accolades comprises) — c est ce
      // que l ecran du journal affiche tant que le message est `pending`.
      output += text.slice(span.start, span.end);
    } else {
      const value = context[span.content] ?? '';
      literalBuffer += value;
      output += value;
    }
    cursor = span.end;
  }
  literalBuffer += text.slice(cursor);
  output += text.slice(cursor);
  flushLiteral();

  return { text: output, segments };
}

/**
 * REMISE : CONCATENATION PURE, AUCUN BALAYAGE (point 11.1). Chaque segment
 * litteral est recopie tel quel ; chaque segment de balise est resolu dans
 * `values` (chaine vide si absente — meme convention que `renderNotificationTags`).
 * Ne relit JAMAIS `text` (le texte provisoire) : c est cette absence de
 * second balayage qui garantit qu une occurrence de `{{files.count}}` a
 * l interieur d un segment litteral (donnee client) ne peut jamais etre
 * resolue.
 */
export function joinDeferredSegments(
  segments: readonly RenderedSegment[],
  values: Readonly<Record<string, string>>,
): string {
  let output = '';
  for (const segment of segments) {
    output += segment.kind === 'literal' ? segment.text : (values[segment.id] ?? '');
  }
  return output;
}
