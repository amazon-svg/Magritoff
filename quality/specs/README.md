# Spécifications fonctionnelles auditables

Ce répertoire reçoit les spécifications fonctionnelles utilisées par les
contrôles qualité automatisés de Magrit. Il constitue la source versionnée que
l'agent de conformité lit pour relier une exigence au code, aux tests et aux
preuves d'exécution.

Les documents d'origine peuvent continuer à être rédigés dans Notion. Après
transfert, leur version Git fait foi pour un audit donné : elle est figée avec
le commit audité et reste donc reproductible.

## Contenu du répertoire

- `spec.schema.json` : schéma JSON Schema 2020-12 du format canonique ;
- `_template.spec.yaml` : modèle minimal à copier pour une nouvelle
  spécification ;
- `<domaine>/<identifiant>.spec.yaml` : spécifications importées, regroupées
  par domaine fonctionnel.

Exemples de chemins :

```text
quality/specs/
├── commercial-quotes/
│   └── e10-10a-send-duplicate.spec.yaml
├── storefront/
│   └── s2-18-mega-menu.spec.yaml
├── _template.spec.yaml
├── README.md
└── spec.schema.json
```

Il n'y a pas d'index manuel à maintenir. Le futur runner découvre tous les
fichiers `**/*.spec.yaml`, à l'exception du modèle préfixé par `_`.

## Format minimal obligatoire

Chaque fichier est un document YAML conforme à `spec.schema.json`. Les champs
obligatoires sont :

- `schemaVersion` : version du présent format, actuellement `1.0` ;
- `id` : identifiant fonctionnel stable, indépendant du titre ;
- `title` : titre lisible par un humain ;
- `status` : `draft`, `review`, `approved` ou `deprecated` ;
- `revision` : entier incrémenté à chaque modification fonctionnelle validée ;
- `source` : origine et date du transfert ;
- `scope` : epic éventuelle, modules et surfaces concernés ;
- `summary` : besoin utilisateur et résultat attendu ;
- `personas` : utilisateurs concernés ;
- `acceptanceCriteria` : critères d'acceptation numérotés et vérifiables.

Une spécification au statut `draft` ou `review` peut être auditée, mais l'agent
doit rendre le verdict `INCONCLUSIVE` sur sa conformité globale. Seule une
spécification `approved` peut conduire à un verdict fonctionnel `PASS` ou
`FAIL`. Une spécification `deprecated` est ignorée, sauf lorsqu'un audit
recherche explicitement les usages résiduels.

## Règles de rédaction

### Identifiants

- `id`, identifiants de persona, règles, critères et scénarios ne changent
  jamais après approbation ;
- utiliser des identifiants courts en minuscules ou majuscules, sans espace,
  par exemple `E10.10a`, `CA-01`, `BR-03`, `UX-02` ;
- renommer un titre ne doit jamais entraîner le renommage de son identifiant ;
- un critère supprimé reste présent avec `status: deprecated` afin de conserver
  la traçabilité historique.

### Critères d'acceptation

Un critère doit décrire un comportement observable, pas une intention vague.

À éviter :

```yaml
description: L'écran doit être simple et rapide.
```

Préférer :

```yaml
description: Après validation du formulaire, la confirmation est visible sans rechargement de page.
```

Chaque critère précise :

- sa priorité (`critical`, `major` ou `minor`) ;
- son statut (`active` ou `deprecated`) ;
- les méthodes de vérification attendues ;
- les références connues vers les tests, scénarios ou documents.

Les références peuvent être absentes au moment de l'import. Leur absence sera
signalée par l'auditeur des tests, mais ne doit pas conduire à inventer un lien.

### Scénarios

Les scénarios sont recommandés pour les parcours UI, les comportements API et
les règles nécessitant plusieurs étapes. Chaque étape sépare :

- `action` : geste de l'utilisateur ou appel effectué ;
- `expected` : résultat objectivement observable.

Les types d'exécution admis sont :

- `human` : recette manuelle ;
- `browser-agent` : navigation Playwright ou navigateur contrôlé ;
- `api` : appels HTTP ;
- `sql` : vérification en base ;
- `automated-test` : test Vitest, Playwright ou autre suite automatisée.

Les `testIds` ne sont que des indications de localisation. Toute nouvelle
valeur doit également être déclarée dans
`src/shared/presentation/testIds.ts`, conformément aux règles du projet.

## Traçabilité Notion

Pour une importation Notion, conserver obligatoirement :

```yaml
source:
  system: notion
  pageId: "identifiant-de-page"
  url: "https://www.notion.so/..."
  importedAt: "2026-09-10T12:00:00Z"
  lastSyncedAt: "2026-09-10T12:00:00Z"
```

`importedAt` est immuable. `lastSyncedAt` indique la dernière synchronisation.
Une modification manuelle postérieure au transfert doit être faite dans Git et
faire progresser `revision`. Si une synchronisation bidirectionnelle est mise
en place ultérieurement, elle devra détecter les conflits au lieu d'écraser la
version Git silencieusement.

## Hiérarchie des sources

En cas de contradiction, l'ordre de priorité est :

1. spécification fonctionnelle `approved` de la story ;
2. wireframe validé référencé par cette spécification ;
3. spécification UX du domaine ;
4. guide UX global ;
5. maquette ou document historique.

Une contradiction non tranchable produit `INCONCLUSIVE` et une question
ouverte dans le rapport. L'agent ne choisit jamais silencieusement la règle qui
l'arrange.

## Données sensibles

Une spécification ne doit contenir aucun secret, jeton, mot de passe, donnée
client réelle ou donnée personnelle inutile. Les données de test utilisent des
valeurs fictives et stables. Les secrets nécessaires à une exécution restent
dans l'environnement du runner et ne sont jamais stockés ici.

## Procédure d'import

1. Copier `_template.spec.yaml` dans le dossier du domaine.
2. Reporter fidèlement le contenu de la source, sans compléter les lacunes par
   supposition.
3. Conserver l'URL, l'identifiant Notion et les dates dans `source`.
4. Attribuer un identifiant stable à chaque règle, critère et scénario.
5. Ajouter les références de tests déjà connues.
6. Exécuter `pnpm specs:validate` pour valider le schéma, les identifiants et
   les références internes.
7. Faire relire puis passer `status` à `approved`.

Le transfert d'une spécification ne vaut pas validation de son contenu. Son
statut doit refléter la décision produit réelle.
