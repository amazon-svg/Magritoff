# Story — Accueil Magrit et workspace partagé HopeStudio / PIM

## Statut

Planification — prête à être découpée en lots d’implémentation.

Date de cadrage : 1er septembre 2026.

## Intention UX

L’interface doit utiliser la position des outils comme repère mental :

- au centre de l’accueil, l’utilisateur exprime un besoin encore indéterminé ;
- à gauche, HopeStudio accompagne la construction et la configuration du
  produit dans une conversation métier ;
- à droite, le PIM permet une recherche explicite dans les produits connus ;
- chaque outil peut temporairement occuper tout l’espace de travail sans faire
  perdre la requête ni l’état de l’autre outil.

Le premier prompt constitue le passage entre l’accueil et l’atelier. Il est
envoyé une seule fois à HopeStudio et initialise en parallèle la recherche PIM.

## Résultat attendu

### État 1 — Accueil Magrit

L’accueil reste produit par Magrit. HopeStudio ne génère pas le hero ni le
composeur principal.

```text
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                         Logo Magrit                              │
│                       Le papier pense.                           │
│                                                                  │
│             [ Décrivez votre projet d’impression… ]             │
│                    [Joindre]          [Envoyer]                  │
│                                                                  │
│                   Suggestions de requêtes                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Le champ est centré sous la promesse afin de matérialiser un point d’entrée
neutre : la demande n’est encore ni une configuration HopeStudio ni une
recherche catalogue.

### État 2 — Workspace partagé

Après validation, l’écran devient un atelier à deux zones.

```text
┌─────────────────────────────┬────────────────────────────────────┐
│ HopeStudio              [⛶] │ Recherche PIM                 [⛶] │
│                             │ [ Rechercher dans le PIM…      🔍 ]│
│ Conversation métier         │                                    │
│ Configurations et prix      │ Résultats, filtres et états        │
│                             │                                    │
│ [ Message HopeStudio…   ↵ ] │                                    │
└─────────────────────────────┴────────────────────────────────────┘
```

Répartition initiale recommandée : 55 % HopeStudio / 45 % PIM. Le premier lot
utilise une séparation fixe. Un séparateur redimensionnable pourra être ajouté
après validation des usages réels.

### États 3 et 4 — Focus

- `studio` : HopeStudio utilise toute la surface disponible ;
- `pim` : la recherche PIM utilise toute la surface disponible ;
- `split` : les deux zones sont visibles ;
- un bouton « revenir aux deux panneaux » est toujours disponible en mode
  focus.

Sur mobile et tablette étroite, le split est remplacé par deux onglets
`Studio` et `Produits`. Les deux composants restent montés pour préserver leur
état.

## Principes retenus

1. **Magrit possède l’accueil.** Le runtime HopeStudio n’est monté qu’après la
   première requête, sauf besoin technique démontré contraire.
2. **Une seule requête initiale, deux consommateurs.** Le texte validé est
   transmis à HopeStudio et au moteur de recherche PIM à partir du même
   événement métier.
3. **Les outils deviennent indépendants après l’initialisation.** Les messages
   HopeStudio suivants ne remplacent pas automatiquement la recherche PIM, et
   une recherche PIM ne devient pas un message HopeStudio sans action explicite.
4. **Aucune interprétation d’affichage par regex.** Les résultats HopeStudio et
   PIM sont affichés depuis des contrats structurés et des templates/composants
   dédiés.
5. **L’état ne dépend pas du DOM HopeStudio.** Le mode `home`, `split`, `studio`
   ou `pim` appartient à React/Magrit.
6. **Un seul système de commandes de focus.** Le MVP utilise les boutons dans
   les en-têtes des panneaux. Une barre latérale locale pourra les dupliquer
   uniquement si les tests utilisateurs en démontrent l’intérêt ; la navigation
   globale Magrit ne doit pas être détournée.

## État actuel du code

### Composition de la page

`src/modules/catalog/ui/workspace/ConfiguratorPage.tsx` :

- charge la configuration HopeStudio du tenant ;
- affiche actuellement `HopeStudioWorkspace` seul lorsque HopeStudio est actif ;
- utilise `ChatInterface` comme repli lorsque HopeStudio est désactivé.

### Workspace HopeStudio

`src/modules/hopstudio/ui/HopeStudioWorkspace.tsx` possède actuellement :

- le hero Magrit et les exemples de prompts ;
- le chargement du runtime headless ;
- l’initialisation de `customApiFetch` ;
- l’état local « conversation commencée » ;
- l’adaptation du composeur, des cartes et du chrome HopeStudio.

Cette accumulation empêche de composer HopeStudio avec une seconde zone. Le
refactoring doit extraire l’accueil et conserver dans `HopeStudioWorkspace`
uniquement la responsabilité du runtime et de l’UX HopeStudio.

### PIM

Le socle existant apporte :

- `CatalogApiClient` et la route de lecture du catalogue PIM ;
- `PIMProvider` avec les gammes et définitions ;
- des composants de cartes produit et des helpers de recherche catalogue côté
  boutique ;
- des helpers de recherche textuelle destinés à l’autocomplétion storefront.

Il n’existe pas encore de surface de recherche PIM adaptée au workspace partagé,
ni de contrat de résultat tenant-scoped dédié à cette intention.

## Architecture cible

```text
ConfiguratorPage
└── ConfiguratorWorkspace
    ├── MagritConfiguratorHome                 état home
    └── DualToolWorkspace                      états split/studio/pim
        ├── WorkspaceModeControls
        ├── HopeStudioPanel
        │   └── HopeStudioWorkspace
        └── PimSearchPanel
            ├── PimSearchBar
            ├── PimSearchFilters
            └── PimSearchResults
                └── PimSearchResultCard
```

### Propriété de l’état

`ConfiguratorWorkspace` devient l’unique propriétaire de :

```ts
type ConfiguratorViewMode = 'home' | 'split' | 'studio' | 'pim';

type InitialConfiguratorRequest = Readonly<{
  id: string;
  query: string;
  submittedAt: string;
}>;
```

État minimal :

- `viewMode` ;
- `initialRequest` ;
- `pimQuery` ;
- dernier panneau actif sur écran étroit ;
- états indépendants de chargement et d’erreur des deux panneaux.

La requête porte un identifiant stable afin que HopeStudio puisse garantir un
envoi « exactement une fois », y compris avec React Strict Mode ou un remontage
du composant.

### Évolution de `HopeStudioWorkspace`

Interface cible indicative :

```ts
type HopeStudioWorkspaceProps = Readonly<{
  tenantId: string;
  userId: string;
  initialRequest: InitialConfiguratorRequest;
  onReady?: () => void;
  onError?: (error: Error) => void;
}>;
```

Responsabilités :

- monter HLUX dans son panneau ;
- configurer `customApiFetch` ;
- attendre que `window.hopes_suite.chat.sendMessage` soit disponible ;
- envoyer `initialRequest.query` une seule fois pour chaque
  `initialRequest.id` ;
- garder son composeur en bas de la zone ;
- ne plus rendre le hero ou les suggestions Magrit ;
- conserver les sessions et callbacks HopeStudio lors des changements de mode.

Le passage en plein écran est un changement CSS de la grille. Il ne doit jamais
démonter ou recréer l’instance HopeStudio.

### Recherche PIM

Contrat cible minimal :

```ts
type PimWorkspaceSearchRequest = Readonly<{
  tenantId: string;
  query: string;
  filters?: Readonly<{
    gammeSlugs?: string[];
    formats?: string[];
  }>;
  cursor?: string;
  limit?: number;
}>;

type PimWorkspaceSearchResult = Readonly<{
  items: PimWorkspaceProduct[];
  total: number;
  nextCursor: string | null;
  facets: PimWorkspaceFacets;
}>;
```

Chaque produit doit au minimum fournir :

- une référence stable ;
- un nom et une gamme ;
- une description courte ;
- une image lorsqu’elle existe ;
- les caractéristiques techniques structurées disponibles ;
- un indicateur de prix calculable ou « prix à la configuration » ;
- la configuration HopeStudio optionnelle lorsqu’elle existe.

Le MVP peut filtrer côté client le catalogue déjà chargé pour valider l’UX. La
cible reste toutefois une route dédiée, par exemple :

```text
GET /api/v1/tenants/{tenantId}/catalog/search?q=...&cursor=...&limit=...
```

Cette route évite de charger tout le PIM dans le navigateur, garantit
l’isolation tenant et pourra accueillir ultérieurement une recherche sémantique.

### Flux de la première requête

```text
Utilisateur
   │ valide la demande
   ▼
ConfiguratorWorkspace
   ├── passe de home à split
   ├── crée InitialConfiguratorRequest
   ├── monte HopeStudioPanel ──► sendMessage(query), une seule fois
   └── initialise PimSearchPanel ──► search(query)
```

Les erreurs sont indépendantes : une panne HopeStudio ne doit pas masquer les
résultats PIM et une panne PIM ne doit pas bloquer la conversation.

## Comportements UX détaillés

### Accueil

- focus clavier automatique dans le champ principal ;
- `Entrée` soumet, `Maj + Entrée` ajoute une ligne si le champ est multiligne ;
- bouton désactivé pour une requête vide ;
- conservation des suggestions actuelles ;
- état de chargement discret pendant la résolution de la configuration tenant.

### Panneau HopeStudio

- titre explicite « Studio » ou « Clariprint Studio » ;
- composeur fixé en bas de son panneau, pas en bas de toute la fenêtre ;
- scroll interne pour la conversation ;
- bouton focus avec libellé accessible ;
- actions et modales HopeStudio confinées visuellement au workspace lorsque
  leur nature ne nécessite pas une modale globale.

### Panneau PIM

- barre de recherche fixée en haut ;
- requête initiale préremplie ;
- recherche déclenchée après soumission ou debounce court selon le coût API ;
- annulation de la requête précédente avec `AbortController` ;
- protection contre les réponses arrivant dans le désordre ;
- états `idle`, `loading`, `success`, `empty`, `error` ;
- résultats en liste dense dans le split et en grille dans le mode PIM plein
  écran ;
- filtres et compteur visibles sans masquer la requête.

### Interactions croisées prévues

À livrer après le socle :

- « Utiliser dans Studio » depuis un résultat PIM ;
- « Rechercher des produits similaires » depuis une carte HopeStudio ;
- ouverture de la fiche PIM sans quitter le workspace ;
- ajout au panier ou à une bibliothèque depuis l’outil pertinent ;
- conservation d’une association entre résultat PIM, configuration HopeStudio
  et conversation Magrit.

Ces interactions doivent utiliser des identifiants et configurations structurés,
jamais le texte rendu comme source de données.

## Responsive et accessibilité

### Largeurs

- `>= 1100 px` : split 55/45 ;
- `768–1099 px` : split 50/50 ou onglets selon la largeur réellement utile des
  composants HopeStudio ;
- `< 768 px` : onglets exclusifs Studio/Produits.

### Accessibilité

- les panneaux sont des régions nommées ;
- les commandes de focus possèdent `aria-label`, `aria-pressed` ou
  `aria-expanded` selon le composant retenu ;
- le passage `home → split` place le focus dans le titre du workspace ou dans
  le premier panneau chargé sans provoquer de saut inattendu ;
- les chargements utilisent `role="status"` ;
- les erreurs utilisent `role="alert"` avec une action de relance ;
- le mode focus est utilisable au clavier et réversible avec `Échap` si cette
  convention est annoncée.

## Découpage d’implémentation

### Lot 0 — Validation des contrats PIM

Objectif : confirmer la source produit et le contrat de recherche avant de
construire la surface.

- identifier la projection PIM faisant autorité pour les résultats ;
- confirmer l’isolation tenant ;
- définir les champs de carte et les filtres du MVP ;
- décider client-side temporaire ou route serveur immédiate ;
- ajouter les contrats Zod et jeux de données de test.

Estimation : 0,5 à 1 jour.

### Lot 1 — Machine d’état et accueil Magrit

- créer `ConfiguratorWorkspace` et son reducer/testable state machine ;
- extraire `MagritConfiguratorHome` de `HopeStudioWorkspace` ;
- remonter le composeur au centre de l’accueil ;
- produire `InitialConfiguratorRequest` à la soumission ;
- conserver le repli `ChatInterface` lorsque HopeStudio est désactivé.

Estimation : 1,5 à 2 jours.

### Lot 2 — Panneaux et modes de focus

- créer `DualToolWorkspace`, les en-têtes et commandes de focus ;
- implémenter les modes `split`, `studio`, `pim` sans démontage ;
- ajouter la transition visuelle depuis l’accueil ;
- implémenter la variante mobile par onglets ;
- vérifier le confinement du scroll et des modales.

Estimation : 1,5 à 2 jours.

### Lot 3 — HopeStudio piloté par Magrit

- retirer définitivement le hero de `HopeStudioWorkspace` ;
- ajouter la propriété `initialRequest` ;
- attendre l’état ready puis envoyer la demande exactement une fois ;
- adapter la hauteur et le composeur à un panneau, au split et au focus ;
- vérifier historique, cartes, prix, formulaires et callbacks dans les trois
  modes.

Estimation : 1,5 à 2 jours.

### Lot 4 — Recherche PIM MVP

- implémenter `PimSearchPanel` et sa barre haute ;
- ajouter le service/repository de recherche ;
- afficher compteur, résultats et états techniques ;
- réutiliser les primitives produit existantes sans importer une page boutique
  complète ;
- gérer annulation, debounce et pagination ;
- tracer durée, statut et volume de résultats.

Estimation : 2 à 3 jours selon la disponibilité de la projection PIM.

### Lot 5 — Interactions croisées

- action « Utiliser dans Studio » ;
- action « Rechercher des produits similaires » ;
- transport d’une configuration HopeStudio depuis/vers un produit PIM ;
- synchronisation avec panier, bibliothèque ou fiche produit selon le périmètre
  retenu.

Estimation : 1,5 à 3 jours selon les callbacks HopeStudio nécessaires.

### Lot 6 — Durcissement UX et livraison

- tests desktop, tablette et mobile ;
- navigation clavier et lecteurs d’écran ;
- captures visuelles de référence ;
- gestion complète loading/empty/error/retry ;
- instrumentation et vérification des traces ;
- activation progressive derrière un feature flag tenant.

Estimation : 1,5 à 2 jours.

### Estimation globale

- socle utilisable avec split et recherche PIM MVP : **7 à 10 jours de
  développement** ;
- interactions croisées et finition complète : **2 à 5 jours supplémentaires** ;
- total indicatif : **9 à 15 jours**, hors évolution du modèle PIM ou des API
  HopeStudio.

L’incertitude principale porte sur la projection PIM réellement recherchable et
sur le callback HopeStudio permettant d’injecter une configuration issue du PIM.

## Fichiers cibles indicatifs

```text
src/modules/catalog/ui/workspace/
  ConfiguratorPage.tsx
  ConfiguratorWorkspace.tsx
  MagritConfiguratorHome.tsx
  DualToolWorkspace.tsx
  PimSearchPanel.tsx

src/modules/catalog/application/
  pim-workspace-search.ts

src/modules/catalog/api/
  client.ts
  contracts.ts

src/modules/hopstudio/ui/
  HopeStudioWorkspace.tsx

tests/modules/catalog/
  configurator-workspace.test.tsx
  pim-workspace-search.test.ts

tests/modules/hopstudio/
  initial-request.test.tsx
```

Le découpage final doit respecter les frontières du module : les composants
catalogue ne lisent pas directement les globals HopeStudio et le module
HopeStudio ne lit pas directement le contexte PIM.

## Stratégie de tests

### Tests unitaires

- transitions `home → split → studio/pim → split` ;
- conservation des deux panneaux lors d’un changement de mode ;
- envoi unique de la requête initiale HopeStudio ;
- mapping du contrat de recherche PIM ;
- annulation et ordre des réponses de recherche ;
- états vide et erreur indépendants.

### Tests d’intégration

- HopeStudio activé : accueil Magrit puis montage du split ;
- HopeStudio désactivé : maintien du parcours actuel ;
- soumission simultanée HopeStudio/PIM avec mocks distincts ;
- panne d’un fournisseur sans perte de l’autre panneau ;
- sélection d’un résultat PIM et appel du callback structuré attendu.

### Tests visuels et E2E

- accueil desktop ;
- split desktop ;
- focus HopeStudio ;
- focus PIM ;
- mobile avec onglets ;
- conversation longue, résultat PIM long et modale HopeStudio ;
- persistance de l’état après ouverture/fermeture d’une fiche.

## Critères d’acceptation

1. L’accueil est rendu par Magrit avec le prompt principal centré.
2. La première validation fait apparaître les zones HopeStudio et PIM.
3. La demande initiale est envoyée exactement une fois à HopeStudio.
4. La recherche PIM est initialisée avec la demande sans dépendre du DOM ou du
   texte rendu par HopeStudio.
5. Les deux panneaux possèdent leurs propres chargements, erreurs et scrolls.
6. Chaque panneau peut occuper toute la surface puis revenir au split sans être
   démonté ni perdre son état.
7. Le composeur HopeStudio reste en bas de la zone gauche.
8. La barre de recherche PIM reste en haut de la zone droite.
9. Sur mobile, les zones deviennent des onglets accessibles.
10. Les données produit sont transportées sous forme structurée ; aucune regex
    d’affichage n’interprète les phrases de l’assistant.
11. L’isolation tenant et l’identité utilisateur restent imposées côté backend.
12. TypeScript, tests ciblés, tests visuels et build de production passent.

## Hors périmètre du premier lot

- fusion automatique des conversations HopeStudio et de l’historique Magrit ;
- moteur de recherche sémantique PIM complet ;
- séparateur redimensionnable ;
- nouvelle persistance de panier ;
- modification du modèle métier HopeStudio ;
- redesign complet des fiches, formulaires et modales HopeStudio ;
- exposition MCP des API HopeStudio.

## Points de décision avant le Lot 4

1. Quelle entité PIM représente un résultat achetable : gamme, définition
   éditoriale, produit boutique ou nouvelle projection ?
2. La recherche MVP doit-elle couvrir seulement le tenant actif ou inclure un
   catalogue partagé ?
3. Quels champs doivent être indexés : nom, description, mots-clés,
   caractéristiques techniques, références Clariprint ?
4. Quel callback HopeStudio reçoit un produit PIM sélectionné et sous quelle
   forme structurée ?
5. La requête initiale brute est-elle suffisante pour le PIM ou faut-il une
   étape backend d’extraction d’intention ?

Ces décisions ne bloquent pas les Lots 1 à 3 : le workspace, le split et le
pilotage initial de HopeStudio peuvent être réalisés avec une recherche PIM
simulée puis raccordés au contrat définitif.
