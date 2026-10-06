---
id: FIX-GARDE
title: Correctif — La règle du panier d'Arnaud était neutralisable par un commentaire
epic: EPIC-E10
feature: FEAT-E10-UNCLASSIFIED
specStatus: draft
deliveryStatus: verified
owner: unassigned
source:
  system: notion
  pageId: 3e1d0131973c81719f1be1344a341dd3
  url: https://app.notion.com/3e1d0131973c81719f1be1344a341dd3
  originalStatus: "Terminé"
  originalSprint: "Sprint 5 — Gestion commerciale"
  originalPriority: "P0"
  originalEffort: "S"
  originalAssignee: "Claude code"
  originalOffering: ""
  originalOrder: "28"
  originalSources: ""
  createdAt: "2026-09-20 07:41:30Z"
  lastEditedAt: "2026-09-20T07:41:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/FIX-GARDE.md
decisions: []
dependencies:
  - Q14-a
supersedes: []
implementationRecords:
  - ../../../tests/_helpers/stripComments.ts
  - ../../../tests/_helpers/stripComments.test.ts
---

# Correctif — La règle du panier d'Arnaud était neutralisable par un commentaire

> Rend la vérification qui protège la règle d'ajout au panier insensible aux commentaires, pour qu'une règle métier ne puisse plus être neutralisée pendant que les tests restent verts.

## Valeur métier

La règle d'Arnaud du 16/09 — un produit non chiffré ne s'ajoute pas tel quel au panier — n'est tenue, côté interface, que par une vérification qui relit le texte du code. Quand cette vérification se laisse tromper, **la règle disparaît sans que rien ne s'allume** : tests verts, compilateur silencieux, et tout produit redevient ajoutable au panier, chiffré ou non. Ce qui est en jeu n'est donc pas un outil de test, c'est la seule chose qui empêche la règle de s'évaporer au prochain remaniement. Le défaut a été rejoué sur la branche principale : il y était vivant.

## Défaut constaté

La vérification qui protège la règle d'ajout au panier était **contournable en ajoutant un commentaire**. Rejoué sur le code de la branche principale : la règle était neutralisée, tout produit redevenait ajoutable au panier, et les treize cas de la vérification restaient verts.

L'origine est un durcissement posé après la revue de `Q14-a` : il fermait la porte du code commenté en bloc et laissait ouverte celle du commentaire de fin de ligne.

Trois faits aggravants, relevés dans la source :

- **Six réécritures, cinq plus faibles que ce qu'elles annonçaient.** À chaque tour, la correction fermait la forme démontrée et en laissait une autre juste à côté. Deux de ces versions venaient du coordinateur.
- **La cinquième version lisait le code au lieu de son texte — et échouait quand même.** L'analyseur employé ne suivait pas le contexte des gabarits de chaîne : sur un fichier réel, il a pris une fin de gabarit pour un début et **avalé 9 792 caractères**. Tous les commentaires au-delà survivaient. Le défaut a été trouvé par le développeur de `Q17-c`, qui a rejoué les vérifications au lieu de se fier au vert.
- **Une cinquième copie sur-nettoyait du code réel** : un chemin d'adresse écrit dans un commentaire ouvrait un faux commentaire qui avalait treize lignes, invisibles pour la vérification protégeant la table unique des libellés de statut.

## Besoin utilisateur

**En tant que** responsable produit ayant arbitré une règle métier, **je veux** que la vérification censée la protéger échoue réellement quand la règle est neutralisée, **afin de** ne pas découvrir en production qu'elle avait disparu.

## Comportement attendu

1. Le nettoyage des commentaires préalable à toute vérification textuelle s'appuie sur une **analyse complète du code** par l'analyseur syntaxique du langage, et non sur une reconnaissance de motifs ni sur un découpage en lexèmes.
2. Aucune forme de commentaire ne survit au nettoyage : fin de ligne, bloc, bloc accolé à un signe de ponctuation, commentaire d'interface.
3. Le nettoyage ne retire rien qui ne soit pas un commentaire : ni une adresse, ni une expression régulière, ni un gabarit de chaîne, ni un attribut.
4. Les positions dans le fichier sont préservées : un commentaire est remplacé par des espaces, les sauts de ligne sont conservés, pour que les vérifications bornées à une fenêtre visent toujours la même zone.
5. Le nettoyage est **un point unique** : toutes les vérifications textuelles du chantier l'utilisent, aucune ne refait le sien.
6. La preuve du nettoyage ne se vérifie pas elle-même : elle s'appuie sur un contrôle indépendant.
7. La limite du procédé est écrite et tenue par un cas de test, pas seulement mentionnée.

## Expérience utilisateur

Aucun effet visible pour l'acheteur ni pour l'atelier. Le destinataire de ce lot est l'équipe : la vérification doit rougir quand la règle est neutralisée, et seulement alors.

## Règles métier

- `RM-01` — Une vérification qui protège une règle métier arbitrée doit échouer quand cette règle est neutralisée. Une vérification verte sur une règle absente est un défaut, pas une imperfection.
- `RM-02` — Le nettoyage des commentaires est obtenu de l'analyseur syntaxique du langage, jamais d'une reconnaissance de motifs ni d'un découpage en lexèmes.
- `RM-03` — Le nettoyage préserve la longueur du fichier et ses sauts de ligne.
- `RM-04` — Il existe un seul nettoyage, partagé ; aucune copie n'est admise. Une copie oubliée a déjà sur-nettoyé du code réel.
- `RM-05` — La preuve du nettoyage s'exerce sur de **vrais fichiers du dépôt**, pas seulement sur des extraits écrits à la main — la version fautive passait tous les extraits et échouait sur un fichier de cinquante kilo-octets.
- `RM-06` — La preuve utilise un contrôle **indépendant** du mécanisme vérifié : une marque connue, injectée **à la fin** du fichier, doit disparaître, et la même marque hors commentaire doit survivre.
- `RM-07` — La limite du procédé est explicite : une vérification textuelle attrape la régression accidentelle, jamais l'évasion délibérée — la chaîne cherchée peut être replacée dans un attribut, où il n'y a rien à retirer. Cette limite est elle-même tenue par un cas de test.
- `RM-08` — Quand une décision peut être extraite en fonction pure et vérifiée sur son comportement, elle doit l'être ; le nettoyage de commentaires n'est un recours que là où rien d'autre n'existe.

## Critères d'acceptation

- `AC-01` — Étant donné la règle d'ajout au panier neutralisée par un commentaire de fin de ligne, quand la vérification s'exécute, alors elle échoue.
- `AC-02` — Étant donné la même neutralisation par un commentaire de bloc, y compris accolé à une virgule ou à une parenthèse ouvrante, quand la vérification s'exécute, alors elle échoue.
- `AC-03` — Étant donné un fichier réel du dépôt comportant des commentaires, quand il est nettoyé, alors il n'en reste aucun, mesuré par un comptage indépendant.
- `AC-04` — Étant donné une marque connue injectée en commentaire **à la fin** d'un fichier réel, quand il est nettoyé, alors la marque a disparu ; et la même marque placée hors commentaire survit.
- `AC-05` — Étant donné un fichier contenant une adresse, une expression régulière, un gabarit de chaîne à substitution ou un attribut comportant les caractères d'un commentaire, quand il est nettoyé, alors aucun code n'est retiré.
- `AC-06` — Étant donné un fichier nettoyé, quand on compare sa longueur et son nombre de lignes à l'original, alors ils sont identiques.
- `AC-07` — Étant donné la chaîne protégée replacée dans un attribut, quand la vérification s'exécute, alors elle ne la détecte pas — limite assumée, épinglée par un cas de test qui l'énonce.
- `AC-08` — Étant donné l'ensemble du dépôt, quand on cherche une seconde copie de ce nettoyage, alors il n'en existe aucune.

## Cas limites

- **L'évasion délibérée reste ouverte.** Replacer la chaîne cherchée dans un attribut n'offre rien à retirer. C'est la limite du procédé, pas de sa mise en œuvre.
- **Une décision extraite en fonction pure échappe entièrement au problème.** C'est la réponse de fond, appliquée dans `Q17-c` ; ce correctif est un pis-aller utile là où le câblage d'interface ne peut pas être observé.
- **Le dépôt n'a aucune bibliothèque de test de rendu.** C'est la cause racine : faute de pouvoir observer ce qu'un écran affiche, les vérifications lisent le texte du code. Décision d'outillage portée dans `Q-ARBITRAGES`.
- **Toute vérification textuelle existante est concernée.** La table unique des libellés de statut (`BCP-5`), l'unicité du constructeur de ligne de panier (`BCP-11`) et les vérifications de `Q17-c` reposent sur le même mécanisme : un défaut ici les fait tomber ensemble, en silence.

## Hors périmètre

- La règle d'ajout au panier elle-même, portée par `Q14-a`.
- Le choix d'une bibliothèque de test de rendu, porté à l'arbitrage dans `Q-ARBITRAGES`.
- La réécriture des vérifications existantes en tests de comportement.

## Dépendances et décisions

- `Q14-a` — règle protégée par cette vérification, et origine du durcissement fautif (dépendance déclarée en frontmatter).
- Règle métier structurante, arbitrage d'Arnaud du 16/09/2026 : « Dans la mesure où le produit comporte les caractéristiques ayant permis de le chiffrer il peut être mis au panier tel quel, sinon il faut le configurer. » C'est cette règle que le défaut neutralisait.
- `Q17-c` — le défaut de la cinquième version a été trouvé par le développeur de ce lot ; la réponse de fond qu'il a appliquée (extraction en fonctions pures) est la méthode de référence.
- **Écart de migration résolu.** L'import avait conservé `deliveryStatus: not-started`
  alors que le correctif existe dans `tests/_helpers/stripComments.ts` et
  `tests/_helpers/stripComments.test.ts`. Le premier fournit l'analyse par le
  parseur TypeScript et préserve les positions ; le second exerce cinq vrais
  fichiers et une marque injectée en fin de fichier. Cinq gardes importent le
  helper partagé. Ces preuves établissent l'état de livraison indépendamment
  de l'attribution historique à `Q17-c`.

## Vérification

Le 6 octobre 2026, la vérification ciblée du parseur et de ses cinq
consommateurs a exécuté 75 tests avec succès :

```text
pnpm exec vitest run \
  tests/_helpers/stripComments.test.ts \
  tests/app/hooks/useDashboardOrderManagement.test.ts \
  tests/components/shop/ShopProductCard.addAsIsWiring.test.ts \
  tests/architecture/order-status-single-source.test.ts \
  tests/components/shop/portal/OrderHistoryTable.wiring.test.ts \
  tests/components/shop/portal/ValidateOrderConfirmDialog.text.test.ts
```

La suite dédiée exerce les commentaires de ligne, de bloc et JSX, les blocs
accolés à la ponctuation, la conservation de la longueur et des sauts de ligne,
les faux positifs connus, cinq fichiers réels et une aiguille injectée en fin de
fichier. Elle épingle aussi la limite assumée d'une chaîne placée dans un
attribut JSX. La recherche des usages confirme que tous les gardes textuels du
dépôt importent le même helper.

_Aucun cahier de tests Notion ne référence cette story._

## Preuves relevées dans le dépôt

`deliveryStatus: verified` — 1 helper partagé · 1 suite dédiée · 5 consommateurs
· 75 tests ciblés passants.

Fichiers d'implémentation :

- `tests/_helpers/stripComments.ts`
- `tests/_helpers/stripComments.test.ts`

Consommateurs vérifiés :

- `tests/app/hooks/useDashboardOrderManagement.test.ts`
- `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts`
- `tests/architecture/order-status-single-source.test.ts`
- `tests/components/shop/portal/OrderHistoryTable.wiring.test.ts`
- `tests/components/shop/portal/ValidateOrderConfirmDialog.text.test.ts`

## Questions ouvertes

- Faut-il poser une règle de projet interdisant toute nouvelle vérification textuelle quand une vérification de comportement est possible ?
- La limite assumée (chaîne replacée dans un attribut) est-elle acceptable pour une règle métier arbitrée, ou exige-t-elle une protection qui ne soit pas textuelle ?
- Rattachement à une fonctionnalité produit à arbitrer (`FEAT-E10-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : contenu issu d'un import, non approuvé.
