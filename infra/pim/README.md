# Référentiel des gammes PIM

[`gammes.json`](gammes.json) conserve les **81 gammes et 16 familles racines** du référentiel historique Magrit. Il a été récupéré le 5 octobre 2026 depuis les migrations versionnées avant le retrait des archives Supabase.

## Contenu

Chaque gamme conserve son `slug`, son `name`, son `parent_slug`, son `display_order` et ses `matching_rules`. Le slug est son identifiant stable ; les UUID et dates générés par l'ancienne base ne sont pas inclus.

Les métadonnées du JSON indiquent le commit source complet, les quatre migrations appliquées dans leur ordre chronologique et leur empreinte SHA-256. Les mises à jour de noms et d'ordre de la dernière migration sont intégrées au résultat.

Ce fichier contient la taxonomie et ses règles de classification. Les fiches éditoriales (`product_definitions`), les produits de bibliothèques, leurs prix et les images ajoutées en base ne sont pas inclus. Il s'agit d'une reconstruction depuis Git, pas d'un export de l'ancienne production ni d'une nouvelle approbation produit.

## Vérification effectuée

Les seules instructions `INSERT` et `UPDATE` portant sur `product_gammes` ont été extraites des quatre migrations. Elles ont été exécutées sur une table temporaire PostgreSQL, puis exportées en JSON avant annulation de la transaction. Les autres instructions des migrations n'ont pas été exécutées.

Contrôles réussis : 81 slugs uniques, 16 racines, parents existants, absence de cycles, règles JSON valides et ordre déterministe par `display_order` puis `slug`.

La récupération n'a modifié aucune table applicative, aucun droit, aucune API et n'a introduit aucune dérogation architecturale.

## Import initial et mises à jour

`pnpm dev:local` et `pnpm db:seed` synchronisent automatiquement ce fichier vers la table globale `product_gammes`, après les migrations. Pour synchroniser uniquement le PIM :

```bash
pnpm db:seed:pim
```

Après ajout ou modification de gammes dans le JSON, relancer cette commande. Le `slug` est la clé de rapprochement : les nouvelles gammes sont créées, les noms, parents, ordres et règles des gammes existantes sont actualisés. Les UUID, images, fiches éditoriales et souscriptions existants sont conservés. Les gammes absentes du fichier ne sont pas supprimées. Renommer un slug crée une nouvelle gamme ; ce n'est pas un renommage de l'ancienne.

L'import valide les doublons, parents manquants et cycles avant toute écriture, puis applique les changements dans une transaction. L'ordre des entrées du JSON n'a pas d'importance. `counts` et `provenance` décrivent la récupération historique ; le seed utilise le tableau `gammes`, qui peut être complété.

La connexion est celle des outils de migration (`MAGRIT_DATABASE_MIGRATION_URL`, puis `DATABASE_URL`, sinon PostgreSQL local). L'import n'active aucune gamme pour un tenant et ne change aucun droit administrateur.

## Arbitrages de hiérarchie

L'ancien référentiel cite ADR-4.17 (familles commerciales et priorité du `gamme_slug` explicite). La décision historique est également décrite dans [`architecture.md`, section S-CAT](../../_bmad-output/planning-artifacts/architecture.md) : la catégorie explicite fait autorité, la famille correspond à sa gamme racine. Aucun nouvel arbitrage n'est pris par ce seed sur la personnalisation des catégories de boutique ou sur l'imposition de la hiérarchie globale aux utilisateurs. Ces sujets restent à discuter avant une évolution de la navigation des boutiques.

## Validation de l'import — 5 octobre 2026

Cinq tests ciblés ont réussi, dont deux sur PostgreSQL réel : import enfant avant parent, rejeu, actualisation des valeurs, conservation des UUID/images/fiches et gammes supplémentaires, rejet d'un cycle sans écriture. Le typage modulaire est vert. Le seed PIM puis le seed complet ont été exécutés sur la base locale : 81 gammes du fichier importées, 82 slugs uniques au total avec la gamme de test préexistante conservée. Aucun contrat API ni droit utilisateur n'a été modifié ; aucune dérogation R5 introduite.

Pour consulter une source historique :

```bash
git show 391dcdc4afedc42d3ca2a264225fef8af9bb9b4e:supabase/migrations/20260710000100_exaprint_gammes.sql
```
