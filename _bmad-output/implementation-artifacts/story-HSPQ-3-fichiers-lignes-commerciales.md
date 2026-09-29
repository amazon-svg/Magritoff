---
id: HSPQ-3
epic: Gestion commerciale
status: done
branch: feat/hopstudio-project-quote-callback
depends_on: [HSPQ-2]
blocks: [HSPQ-4]
---
# HSPQ-3 — Gérer les fichiers typés des lignes commerciales

<!-- notion-functional:begin — aucune story Notion rattachée ; section maintenue dans le dépôt (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel

> Cette story de liaison est née dans le dépôt. Elle recoupe les intentions des
> stories Notion E10.17 et E10.20 sur la visibilité des fichiers, sans prétendre
> les remplacer ni modifier leur périmètre fonctionnel.

**En tant que** membre de l’atelier, **je veux** gérer les mêmes fichiers sur
une ligne de projet, de devis ou de commande, **afin de** conserver les pièces
techniques pendant tout le cycle commercial.

### Critères d’acceptation

1. Un fichier canonique est stocké une seule fois puis associé à une ligne de
   projet, de devis et/ou de commande.
2. Chaque fichier porte un type métier distinct de son MIME :
   `supplier_quote`, `cutting_template`, `folding_template`,
   `technical_template`, `artwork`, `proof` ou `other`.
3. Chaque fichier porte une visibilité `customer` ou `internal`, avec
   `internal` par défaut.
4. Les associations sont propagées dans les deux sens temporels : fichier créé
   avant ou après la ligne dérivée.
5. La même fenêtre permet de lister, téléverser, prévisualiser, télécharger et
   supprimer un fichier sur les trois types de ligne.
6. Les objets restent dans un bucket privé ; les lectures passent par des URL
   signées et temporaires après contrôle du tenant et de la ligne.
7. Le SVG PAO HopeStudio est `customer`, le SVG production est `internal`.
8. La visibilité est une donnée disponible pour les consommateurs ; cette
   story n’ajoute pas à elle seule une nouvelle route publique anonyme.

### Cas de test rattachés

Voir `CT-HSPQ-017` à `CT-HSPQ-024` dans le
[carnet de tests de la PR](./carnet-tests-hopstudio-project-quote-callback.md).

---

_Fin du périmètre fonctionnel. La suite décrit l’implémentation._
<!-- notion-functional:end -->

## Implémentation livrée

- `commercial_files` contient les métadonnées et le chemin de l’objet privé.
- Trois tables d’association relient le même fichier aux lignes projet, devis
  et commande.
- Les triggers propagent les associations lors des transformations
  `project_item -> commercial_quote_line -> commercial_order_line`.
- L’API `/commercial-line-files/{lineType}/{lineId}` est servie par un module
  dédié et refuse les clés de service.
- `CommercialLineFilesButton` fournit la fenêtre commune aux trois écrans.
- Le modèle de visibilité est aligné sur le vocabulaire existant
  `customer`/`internal`.

## Hors périmètre

- exposition anonyme d’un fichier `customer` ;
- antivirus ou inspection du contenu des archives ;
- copie physique des octets à chaque transformation commerciale ;
- déduction automatique de la visibilité à partir du type métier.

## Preuves et fichiers principaux

- `supabase/migrations/20260925000100_commercial_line_files.sql`
- `supabase/migrations/20260928000200_commercial_line_file_management.sql`
- `supabase/migrations/20260929000100_commercial_line_file_visibility_svg.sql`
- `src/modules/commercial-line-files/`
- `src/adapters/supabase/commercial-line-files-repository.ts`
- `src/server/api/commercial-line-files-routes.ts`
- `tests/contract/commercial-line-files.contract.test.ts`
- `tests/sql/gescom-commercial-line-files.sql`
- `docs/HOPSTUDIO_COMMERCIAL_LINE_FILES.md`

## Dette et vigilance

- La consommation storefront de la visibilité `customer` doit rester couverte
  par les stories E10.17/E10.20 et ne doit jamais exposer `internal`.
- La migration de visibilité a été validée transactionnellement. Son application
  par la chaîne globale reste soumise à la résolution de l’ancien historique de
  migrations locales.

