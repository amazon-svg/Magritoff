# Guide UX canonique — Magrit

> **Statut :** référence transversale pour les développements et audits UX.
> Ce document consolide des décisions déjà présentes dans le design handoff,
> les spécifications UX et les règles d'architecture. Il ne remplace pas une
> spécification fonctionnelle ou un wireframe validé pour une story.

Les formulations « doit », « interdit » et « obligatoire » sont normatives.
« Préférer » exprime une recommandation qui peut être écartée avec une raison
documentée. Une mesure ou un comportement propre à un parcours appartient à sa
spécification fonctionnelle : le présent guide ne doit pas l'inventer.

## 1. Hiérarchie des sources

En cas de contradiction, appliquer l'ordre suivant :

1. spécification fonctionnelle `approved` de la story dans `quality/specs/` ;
2. wireframe validé explicitement référencé par cette spécification ;
3. spécification UX du domaine ;
4. présent guide UX transversal ;
5. maquette, capture ou document historique.

Une contradiction non tranchable n'est jamais arbitrée silencieusement par un
développeur ou un agent. Elle produit une question ouverte et un verdict UX
`INCONCLUSIVE` jusqu'à décision produit.

## 2. Sources consolidées

- [Règles d'architecture](REGLES_ARCHITECTURE.md), notamment R2.1 et R7 ;
- [Design handoff Magrit v2](../.design-handoff/README.md) ;
- [Tokens Magrit v2](../src/styles/tokens.css) ;
- [UX Design Specification — boutique v2](../_bmad-output/planning-artifacts/ux-design-specification.md) ;
- [UX Design Spec — extension e-commerce](../_bmad-output/planning-artifacts/ux-design-ecom-boutique-2026-07-07.md) ;
- [WCAG 2.2 — recommandation W3C](https://www.w3.org/TR/WCAG22/) ;
- wireframes validés sous `.design-handoff/wireframes/`.

Les fichiers HTML et captures du handoff sont des références visuelles. Ils ne
sont pas du code de production à copier et leurs anciens chemins de composants
ne prévalent pas sur l'architecture modulaire actuelle.

## 3. Principes d'expérience

### 3.1 Partir de l'objectif utilisateur

Chaque écran sert un persona et un objectif décrits dans une spécification. La
hiérarchie visuelle met en avant l'action qui permet d'atteindre cet objectif,
pas la structure interne du système.

Les personas transversaux sont notamment :

- l'imprimeur ou collaborateur Magrit, utilisateur professionnel pressé ;
- l'acheteur B2B, qui ne maîtrise pas nécessairement le vocabulaire print ;
- l'administrateur du tenant, qui configure accès et règles ;
- le validateur ou producteur, qui agit selon ses capacités métier.

### 3.2 Aucun cul-de-sac

Un résultat vide, une ressource indisponible, un prix impossible ou une erreur
doit toujours proposer une explication et une suite pertinente : réessayer,
modifier le choix, revenir, contacter ou demander à Magrit selon le contexte.
Un spinner infini, une page blanche ou une action sans retour sont interdits.

### 3.3 Sobriété et efficacité

- privilégier le scan et les repères visuels à la lecture de longs blocs ;
- limiter les actions secondaires visibles en permanence ;
- éviter carrousels automatiques, animations gratuites et effets agressifs ;
- faire porter la valeur par la rapidité, la clarté et la fiabilité du résultat ;
- expliquer le jargon métier au moment où il devient utile.

## 4. Architecture de présentation

- Toute UX métier appartient à `src/modules/<module>/ui`.
- `src/app` assemble les surfaces, layouts et boundaries sans posséder la
  logique de présentation métier.
- Les primitives génériques vivent dans `src/shared/ui`.
- Une UI de module ne dépend ni d'un adaptateur concret, ni de Supabase, ni de
  l'intérieur d'un autre module.
- La logique réseau et les règles falsifiables en contournant le navigateur ne
  résident pas dans les composants de vue.

Les composants existants non conformes relèvent de la dérogation R5. Aucun
nouveau code ne doit étendre cette dette sans dérogation explicite et plan de
remédiation.

## 5. Design system

### 5.1 Fondations

- Tailwind v4 et primitives partagées existantes ;
- shadcn/ui et Radix pour les interactions accessibles déjà couvertes ;
- icônes Lucide cohérentes, jamais utilisées seules sans nom accessible ;
- variables CSS pour la marque et le thème tenant ;
- aucune nouvelle dépendance UI sans décision explicite.

### 5.2 Tokens obligatoires

Les couleurs, espacements, rayons, ombres, typographies et mouvements utilisent
les tokens de `src/styles/tokens.css`. Une valeur ad hoc n'est admise que si
aucun token ne représente le rôle sémantique recherché ; elle doit alors mener
à une décision d'extension du système, pas être dupliquée écran par écran.

Deux couches de couleurs restent distinctes :

- **marque tenant** : logo, couleurs dominantes et CTA primaires ;
- **sémantique Magrit** : succès, avertissement, erreur, information et source
  de prix.

La couleur seule ne porte jamais une information. Elle est accompagnée d'un
libellé, d'une forme ou d'une icône accessible.

### 5.3 Hiérarchie visuelle

- un seul H1 par page ;
- titres et sections suivent une hiérarchie HTML cohérente ;
- prix, quantités, dates et identifiants peuvent utiliser la fonte mono ;
- le corps de texte conserve une fonte de lecture ;
- bordures fines et espaces structurent avant les fonds ou ombres fortes ;
- les composants répétés conservent le même ordre d'information et les mêmes
  affordances sur toutes les surfaces concernées.

## 6. États obligatoires

Tout composant dépendant de données traite explicitement :

1. `initial` si une action préalable est nécessaire ;
2. `loading` avec feedback local et stable ;
3. `empty` avec explication et action éventuelle ;
4. `success` avec résultat et confirmation appropriée ;
5. `error` avec message compréhensible et possibilité de reprise ;
6. `stale` ou conflit lorsque la donnée affichée n'est plus modifiable en
   sécurité.

Selon le parcours, il traite aussi `forbidden`, `offline`, résultat partiel et
expiration de session. Un refus d'action n'est pas présenté comme une ressource
vide, sauf si le contrat de sécurité impose volontairement de rendre ressource
absente et ressource interdite indistinguables. Une panne réseau n'est pas
présentée comme une erreur de saisie.

Le chargement ne doit pas effacer inutilement tout l'écran. Préférer un
skeleton ou indicateur local qui conserve le contexte. Une action asynchrone
désactive les doubles soumissions tout en indiquant sa progression.

Les seuils de performance propres à un parcours restent définis dans sa
spécification. À défaut, tout délai perceptible reçoit immédiatement un retour
visuel et aucune attente n'est laissée sans borne ni message.

Les réponses asynchrones arrivées dans le désordre ne doivent pas remplacer un
état plus récent. Une recherche, un recalcul de prix ou un changement de filtre
annule ou ignore les requêtes devenues obsolètes. Un skeleton réserve l'espace
utile afin de limiter les déplacements de contenu.

## 7. Formulaires et actions

- chaque champ possède un label visible ou un nom accessible explicite ;
- aide et unité apparaissent près de la valeur concernée ;
- validation au plus près du champ, sans attendre la fin d'un long parcours ;
- une erreur conserve les données déjà saisies et place le focus utilement ;
- les champs obligatoires et formats attendus sont annoncés avant soumission ;
- les erreurs globales renvoient vers les champs concernés et le premier champ
  invalide reçoit le focus lorsque cela aide réellement la correction ;
- le collage, les gestionnaires de mots de passe et l'autocomplétion ne sont
  pas désactivés sans nécessité démontrée ;
- une action irréversible ou sensible demande confirmation et décrit son
  impact ;
- le mode d'enregistrement, explicite ou automatique, est celui de la
  spécification de la story : aucun comportement global n'est supposé ;
- succès, échec et conflit ne reposent pas sur un toast éphémère seulement.

Le libellé d'un bouton décrit l'action métier. Éviter les intitulés ambigus
comme « OK », « Valider » ou « Continuer » lorsqu'une formulation plus précise
est possible.

## 8. Navigation et continuité

- l'utilisateur sait où il se trouve et comment revenir ;
- les actions principales restent atteignables au clavier et au tactile ;
- une navigation ne perd pas silencieusement un travail non enregistré ;
- filtres, pagination et sélection conservent leur état lorsque le parcours le
  nécessite ;
- les changements de tenant, boutique ou identité sont explicites ;
- aucune donnée ou navigation workspace ne fuit vers le storefront, et
  inversement.

Un dialog, drawer, menu ou popover restitue le focus à son déclencheur lors de
sa fermeture. Le bouton Retour conserve le sens du parcours ; une vue métier
importante doit être adressable par URL lorsque la spécification exige partage,
rafraîchissement ou reprise.

## 9. Responsive

Les parcours sont fonctionnels au minimum aux largeurs de référence :

- mobile : 375 px ;
- tablette : 768 px ;
- desktop : 1280 px.

Les breakpoints Tailwind standards sont privilégiés. Aucun parcours ne devient
impossible sur mobile, y compris la configuration, la commande et les actions
métier autorisées au persona.

Sur écran étroit :

- l'ordre du contenu suit la priorité métier ;
- les tableaux proposent une adaptation conçue, pas un débordement accidentel ;
- les actions critiques ne dépendent pas du survol ;
- les éléments sticky ne masquent ni contenu, ni clavier, ni message d'erreur ;
- les cibles tactiles mesurent au moins 44 × 44 px.

La cible projet de 44 × 44 px est une exigence ergonomique Magrit. Pour la
conformité WCAG 2.2 AA, aucune cible ne descend sous le minimum applicable de
24 × 24 CSS px sans satisfaire une exception normative d'espacement ou
d'équivalence.

À 400 % de zoom ou sur une largeur équivalente à 320 CSS px, le contenu reste
lisible et opérable sans défilement dans deux directions, sauf contenu dont la
présentation bidimensionnelle est essentielle, par exemple certains tableaux
ou canevas.

## 10. Accessibilité

Objectif transversal : WCAG 2.2 niveau AA.

- HTML sémantique avant ajout d'ARIA ;
- navigation complète avec Tab, Shift+Tab, Entrée et Échap ;
- focus toujours visible et ordre de focus logique ;
- le focus n'est pas entièrement masqué par un header, footer ou composant
  sticky ;
- focus trap et restitution du focus pour dialogs et drawers ;
- contraste texte/fond AA, y compris avec le thème tenant et le dark mode ;
- texte alternatif descriptif pour les images porteuses d'information ;
- `aria-live` adapté aux résultats dynamiques importants ;
- landmarks et titres permettent de comprendre la structure ;
- aucune information portée uniquement par couleur, position ou animation ;
- `prefers-reduced-motion` respecté ;
- zoom et agrandissement du texte ne rendent pas le parcours inutilisable ;
- toute interaction fondée sur un glisser-déposer possède une alternative sans
  glissement ;
- l'authentification reste compatible avec les gestionnaires de mots de passe
  et n'impose pas un test cognitif sans alternative accessible.

Axe-core détecte une partie des défauts seulement. Une recette clavier et une
inspection humaine ou assistée restent requises pour les parcours critiques.

## 11. Microcopy

- français clair, concis et cohérent avec le vocabulaire produit ;
- vocabulaire technique expliqué à l'acheteur lorsqu'il ne peut être évité ;
- messages d'erreur orientés vers la résolution, sans exposer les détails
  internes ;
- état, conséquence et prochaine action sont distinguables ;
- la persona IA est nommée `Magrit` ;
- les textes temporaires, lorem ipsum et codes bruts sont interdits en surface
  utilisateur livrée.

## 12. Preuves exigées pour une recette UX

Une recette UX complète s'effectue contre une application démarrée et une base
de test représentative. Elle fournit :

- commit et environnement audités ;
- persona, préconditions et données utilisées ;
- largeur et navigateur ;
- étapes exécutées et résultats observés ;
- captures aux moments significatifs ;
- trace Playwright lors d'un échec ;
- erreurs console et requêtes réseau en échec ;
- résultat axe sur l'état réellement affiché ;
- résultat de la navigation clavier ;
- limitations et parties non visitées.

Une lecture de code, un build réussi ou une capture unique ne suffit pas à
déclarer l'UX conforme.

### 12.1 Matrice minimale de recette

Avant l'exécution, la recette établit une matrice contenant au minimum :

| Dimension | Valeurs attendues |
|---|---|
| Persona | personas autorisés et non autorisés concernés |
| Parcours | nominal, vide, erreur, reprise et conflit applicables |
| Viewport | 375 px, 768 px et 1280 px |
| Entrée | souris, tactile et clavier selon le parcours |
| Données | jeu identifié, tenant et état initial reproductibles |
| Preuve | assertion, capture, trace, axe, console et réseau selon le cas |

Un audit ciblé peut réduire cette matrice si son périmètre est explicite. Un
audit intégral commence par inventorier les routes et parcours critiques ; il
ne déclare pas couvert ce qui n'a pas été visité. Chromium est exécuté à chaque
recette automatisée. Les parcours publics critiques sont également vérifiés
avec WebKit avant une release, sauf dérogation documentée.

### 12.2 Niveaux de preuve

- **Statique** : code, styles, tokens, structure HTML probable et tests. Peut
  démontrer une violation précise, mais jamais suffire à déclarer l'UX réelle
  conforme.
- **Automatisé en navigateur** : parcours Playwright, captures, console,
  réseau et axe sur un état réellement rendu.
- **Humain assisté** : compréhension, hiérarchie, microcopy, clavier complet,
  lecteur d'écran et pertinence du parcours.

Une exigence est rattachée à la preuve la plus proche de son comportement. Un
test axe vert ne prouve ni la compréhension, ni l'ordre de lecture utile, ni la
réussite du parcours.

## 13. Verdicts et constats d'audit

### 13.1 Verdict

- `PASS` : tous les parcours critiques du périmètre ont été exécutés avec les
  données et viewports requis, sans constat critique ou majeur ouvert.
- `WARN` : le parcours reste utilisable et conforme à son objectif, avec
  uniquement des écarts mineurs ou une dérogation acceptée et bornée.
- `FAIL` : une exigence vérifiable est violée, un parcours critique échoue ou
  un utilisateur autorisé ne peut pas atteindre son objectif.
- `INCONCLUSIVE` : une source, route, session, donnée, viewport ou preuve
  nécessaire manque. Ce verdict ne signifie ni succès, ni échec.

Un audit statique seul peut produire `FAIL` avec une preuve directe, mais pas
`PASS` pour l'UX réelle. Un contrôle navigateur ignoré ne peut jamais être
compté comme réussi.

### 13.2 Sévérité

- `critical` : blocage, perte de données, action irréversible involontaire,
  fuite inter-tenant, impossibilité d'utiliser un parcours critique ou barrière
  d'accessibilité totale ;
- `major` : objectif fortement dégradé, erreur sans reprise, information métier
  trompeuse ou non-conformité AA démontrée ;
- `minor` : friction locale avec contournement évident, incohérence visuelle ou
  rédactionnelle sans ambiguïté métier ;
- `info` : observation ou amélioration sans non-conformité démontrée.

Chaque constat cite une exigence et une preuve actuelle : route et état observé,
capture/trace, ou fichier et lignes. Une ancienne spécification, une dette
historique ou l'absence d'un fichier dans un lot LLM ne prouve pas que le défaut
existe au commit audité. Les constats partageant la même cause racine sont
regroupés ; une occurrence supplémentaire devient une localisation, pas un
nouveau constat.

### 13.3 Contrôle et assistance par IA

Une suggestion de Magrit reste identifiable comme une assistance, révocable et
modifiable. Elle ne déclenche jamais silencieusement une commande, un paiement,
une suppression, une publication ou un changement de permission. Les faits
métier déterminants — prix, délai, quantité, destinataire et impact — sont
confirmés depuis une source applicative avant l'action.

L'auditeur LLM travaille en lecture seule. Il distingue constat observé,
inférence et absence de preuve ; il ne transforme pas une limitation en défaut.
Ses conclusions sont relues à partir des chemins, lignes, captures et traces
cités avant création d'une action corrective.

## 14. Dérogations

Toute dérogation indique :

- règle concernée ;
- justification et périmètre exact ;
- risque utilisateur ;
- propriétaire ;
- échéance ;
- chemin de mise en conformité.

Une dette historique peut être conservée selon R5. Elle ne devient pas pour
autant la référence à reproduire dans du code nouveau.
