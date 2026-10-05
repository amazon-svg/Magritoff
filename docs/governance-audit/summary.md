# Audit de correspondance des artefacts de gouvernance

## Statut et périmètre

Cet audit constitue l'étape 0 définie dans `docs/GOUVERNANCE_PRODUIT_BACKLOG_SPECIFICATIONS.md`. Il est descriptif et ne modifie aucune règle actuellement opposable.

L'inventaire couvre :

- `quality/specs` ;
- `docs/spec` ;
- `_bmad-output/planning-artifacts` ;
- `_bmad-output/implementation-artifacts` ;
- `_bmad-output/refacto-artifacts` ;
- `docs/architecture` et `docs/api` ;
- `CLAUDE.md`, `ARCHITECTURE.md`, `SPRINT_HANDOFF.md`, `V3_MULTI_TENANT.md` et `docs/project-context.md`.

Les fichiers de code et de tests ne sont pas inventoriés individuellement. Leurs références présentes dans les artefacts documentaires sont relevées automatiquement. La validité de chaque lien vers un test doit être confirmée pendant le pilote.

L'inventaire est reproductible avec :

```bash
node scripts/audit-governance-artifacts.mjs
```

Il produit `docs/governance-audit/inventory.csv`.

## Conclusion

La création immédiate d'une nouvelle arborescence `project/` n'est pas recommandée.

Le dépôt possède déjà des conventions, chemins et contrôles actifs. Une nouvelle arborescence créerait une source supplémentaire tant que ces mécanismes ne sont pas adaptés. La meilleure stratégie est de normaliser progressivement l'existant, de choisir un format fonctionnel canonique au moyen d'un pilote, puis seulement de décider si certains dossiers doivent être déplacés.

Le système actuel n'est pas vide. Il est composé de trois couches inégalement abouties :

1. un corpus important de story documents mêlant copie fonctionnelle Notion et journal d'implémentation ;
2. des règles techniques réellement opposables et déjà utilisées par les agents ;
3. un mécanisme de spécifications auditables bien conçu, mais sans spécification métier importée.

La priorité n'est donc pas de créer de nouveaux fichiers. Elle est de déterminer quelle partie de chaque story document devient la spécification Git, quelle partie reste un historique de livraison et comment les règles opposables existantes sont conservées.

## Résultats quantitatifs

### Corpus inventorié

| Groupe | Nombre de fichiers |
|---|---:|
| `_bmad-output/implementation-artifacts` | 567 |
| `_bmad-output/planning-artifacts` | 27 |
| `_bmad-output/refacto-artifacts` | 4 |
| `quality/specs` | 3 |
| `docs/spec` | 3 |
| Architecture et API dans `docs` | 4 |
| Documents de contexte et de racine sélectionnés | 5 |
| **Total** | **613** |

### Story documents

| Indicateur | Résultat |
|---|---:|
| Story documents | 541 |
| Avec frontmatter | 502 |
| Sans frontmatter | 39 |
| Avec section `notion-functional` | 533 |
| Sans section `notion-functional` | 8 |
| Déclarant explicitement Notion comme autorité | 213 |
| Avec un signal d'implémentation réel | 328 |
| Avec une section de critères d'acceptation détectable | 228 |
| Avec au moins une référence explicite vers un test ou un cas TF | 177 |
| Familles d'identifiants détectées | 30 |
| Variantes non vides de statut documentaire | 54 |

Ces nombres montrent que le corpus est riche, mais pas homogène. La présence d'un story document ne garantit ni une spécification approuvée, ni une implémentation, ni une preuve de test.

### Correspondance avec Notion

L'index généré `INDEX-stories-notion.md` contient 197 entrées :

| Statut Notion | Nombre |
|---|---:|
| Pas commencé | 146 |
| Terminé | 48 |
| En cours | 3 |

Les 533 story documents possédant une section `notion-functional` ne correspondent pas à 533 stories Notion. Une grande partie des documents techniques utilisent le même encadrement pour déclarer qu'aucune story Notion n'est rattachée. Plusieurs stories Notion sont également découpées en lots techniques partageant le même périmètre fonctionnel parent.

L'inventaire détecte dix lots comportant un signal d'implémentation alors que leur story Notion parente reste « Pas commencé ». Ils appartiennent principalement à E10.15, E10.19 et E10.20. Ce résultat confirme que le statut fonctionnel parent et le statut de livraison des lots doivent être séparés.

### `quality/specs`

Le dossier contient exactement trois fichiers :

- un schéma JSON ;
- un modèle YAML ;
- un document de règles.

Il ne contient encore aucune spécification fonctionnelle métier conforme au schéma. Le mécanisme est donc un socle technique prometteur, mais pas une source fonctionnelle effective à ce jour.

Le validateur `pnpm specs:validate` existe déjà et doit être conservé. Le pilote devra vérifier si le schéma actuel peut représenter les relations parent-enfant, les statuts de livraison, les décisions, les remplacements de critères et la traçabilité attendue.

## Conventions concurrentes constatées

### Identifiants

Les principales familles sont :

| Famille | Nombre de story documents |
|---|---:|
| AF | 121 |
| S | 77 |
| UM | 76 |
| E hors E10 | 67 |
| E10 | 49 |
| T08 | 28 |
| US | 16 |
| BCP | 11 |
| P0 | 11 |
| R | 11 |

Vingt autres familles ou variantes existent. Le problème n'est pas nécessairement la diversité des préfixes, car ils correspondent à des chantiers différents. Le problème est l'absence d'un registre expliquant leur portée, leur format et leurs relations.

### Statuts

Le frontmatter des story documents contient 54 formulations distinctes de statut. Certaines valeurs expriment un état simple (`done`, `review`), tandis que d'autres incorporent une histoire complète de revue, une réserve ou une instruction.

Ces informations sont utiles, mais elles ne peuvent pas servir directement à un traitement automatique. Il faut séparer :

- l'état documentaire ;
- l'état de livraison ;
- l'état de revue ;
- les réserves ;
- la preuve d'exécution.

### Autorité fonctionnelle

`docs/spec/STORY_DOCUMENT_STANDARD.md` et `CLAUDE.md` déclarent actuellement que Notion fait foi. Cette règle est active et ne peut pas être remplacée uniquement par le document de gouvernance, qui reste non opposable.

La sortie de Notion exigera au minimum :

1. une archive finale ;
2. l'import du périmètre fonctionnel utile dans Git ;
3. l'approbation du nouveau contenu canonique ;
4. la modification coordonnée de `STORY_DOCUMENT_STANDARD.md`, `CLAUDE.md` et du script de synchronisation ;
5. la suppression ou neutralisation de la dépendance aux marqueurs `notion-functional`.

## Hiérarchie technique existante

Plusieurs documents sont déjà explicitement opposables :

- `docs/REGLES_ARCHITECTURE.md` pour les règles R1 à R8 ;
- `openapi/magrit-core.v1.yaml` pour le contrat API E10 ;
- `docs/api/CONVENTIONS.md` pour les conventions et décisions E10 ;
- `CLAUDE.md` comme point d'entrée chargé par les agents.

Le futur document de gouvernance ne doit pas annuler implicitement ces règles.

La relation recommandée est la suivante :

- la gouvernance définit comment une règle est créée, approuvée, modifiée et remplacée ;
- `REGLES_ARCHITECTURE.md` reste opposable dans son périmètre technique jusqu'à décision explicite de remplacement ;
- le contrat OpenAPI reste la source du contrat d'interface ;
- `CLAUDE.md` reste un point d'entrée et doit référencer les sources canoniques au lieu de recopier leurs règles ;
- les contradictions sont résolues par une décision versionnée, jamais par la simple ancienneté ou le déplacement d'un fichier.

`docs/api/CONVENTIONS.md` mérite un traitement particulier. Il dépasse 1,3 Mo et mélange conventions transverses, décisions, cadrages de stories et comptes rendus d'arbitrage. Il est utile et opposable, mais sa densité rend difficile l'identification de la règle courante. Il doit être décomposé progressivement, sans perte d'autorité, en politiques API stables, décisions d'architecture et références vers les spécifications concernées.

## Artefacts surchargés ou dérivés

### `SPRINT_HANDOFF.md`

Ce document dépasse 200 Ko. Il contient simultanément :

- état de livraison ;
- décisions ;
- incidents ;
- résultats de tests ;
- procédures opérationnelles ;
- dettes ;
- notes de reprise de session.

Il reste utile comme archive, mais ne doit plus être la seule source d'une décision ou de l'état d'une fonctionnalité. Son contenu doit être extrait progressivement vers les artefacts appropriés pendant les pilotes, sans réécriture massive préalable.

### `docs/spec/backlog.md`

Ce fichier est déjà une vue agrégée du backlog et annonce 306 stories indexées, auxquelles s'ajoute le Sprint 5. Il doit être considéré comme une vue dérivée à régénérer, et non comme une nouvelle source de stories.

### `epics.md` et les PRD

`_bmad-output/planning-artifacts/epics.md` contient à la fois des epics, des stories, des sprints et des validations. Deux PRD et plusieurs spécifications de domaine coexistent. Ils doivent être consolidés par domaine et par décision de périmètre, pas déplacés tels quels.

## Niveau réel de traçabilité des tests

Cent soixante-dix-sept story documents contiennent au moins une référence explicite vers un fichier de test ou un identifiant TF. Ce nombre mesure la présence de références, pas leur qualité.

Une story peut mentionner un test sans que ce test vérifie un critère précis. Elle peut également citer un test uniquement parce qu'il échouait sans rapport avec la story. Le pilote devra donc distinguer :

- preuve directe d'un critère ;
- garde de non-régression transverse ;
- commande de validation générale ;
- test cité comme échec extérieur au périmètre.

Cette distinction doit être intégrée au futur schéma de traçabilité.

## RACI minimal à décider

La gouvernance ne doit pas dépendre d'une personne chargée à plein temps de maintenir la documentation. Le socle obligatoire peut fonctionner avec cinq responsabilités :

| Activité | Responsable | Approbateur | Consulté | Informé |
|---|---|---|---|---|
| Vision, périmètre et règle métier | Rédacteur produit | Autorité produit à nommer | Autorité technique si impact | Équipe projet |
| Architecture et contrat technique | Rédacteur technique | Autorité technique à nommer | Autorité produit si impact | Équipe projet |
| Story et critères d'acceptation | Préparateur ou agent | Autorité produit | Développeur et testeur | Équipe projet |
| Implémentation et état de livraison | Développeur ou agent | Relecteur distinct | Autorité technique | Autorité produit |
| Compte rendu et propagation | Rédacteur de séance | Participants ou décideur | Propriétaires des artefacts | Équipe projet |

Un agent peut préparer, extraire, vérifier et proposer. Il ne doit pas s'auto-attribuer l'approbation produit ou technique.

Les noms des personnes correspondant aux rôles doivent être décidés avant le passage de toute nouvelle spécification au statut `approved`.

## Socle obligatoire recommandé

Pour rester adapté à une petite équipe, seuls les éléments suivants devraient être obligatoires au départ :

1. identifiant stable ;
2. source et statut documentaire ;
3. statut de livraison séparé ;
4. critères d'acceptation observables ;
5. décisions liées ;
6. tests ou méthode de vérification ;
7. approbateur identifié ;
8. historique assuré par Git.

Les matrices détaillées, niveaux de confiance et rapports supplémentaires ne doivent être exigés que pour les migrations, contradictions ou fonctions à risque.

## Décisions à prendre après le pilote

Le pilote doit permettre de trancher les points suivants :

1. `quality/specs` devient-il le support canonique de la spécification fonctionnelle ?
2. Le story document reste-t-il un document mixte ou devient-il un historique d'implémentation qui référence la spécification ?
3. Faut-il créer `project/`, ou normaliser `docs`, `quality/specs` et `_bmad-output` ?
4. Comment représenter les relations parent, lot, remplacement et dépréciation ?
5. Quel rôle approuve le produit et quel rôle approuve la technique ?
6. Quels statuts courts remplacent les 54 formulations actuelles ?
7. Comment les agents découvrent-ils les règles opposables sans les recopier dans `CLAUDE.md` ?

## Recommandation immédiate

Le prochain travail doit être un micro-pilote sur E10.15, puis une extension au domaine E10 si le modèle fonctionne.

E10.15 concentre les difficultés recherchées : une story fonctionnelle parente, plusieurs lots techniques, un statut Notion obsolète, un contrat API, des migrations, de nombreux tests, des décisions techniques et une partie différée. Il permet de tester le futur modèle sans déplacer les 541 story documents.

La recommandation détaillée figure dans `pilot-recommendation.md`.
