---
id: UM10.26
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.25]
---
# UM10.26 — Réparer automatiquement l'Edge Runtime local

## Problème

La CLI Supabase peut considérer la stack locale démarrée alors que le conteneur
`supabase_edge_runtime` a été tué, notamment après un arrêt avec le code 137.
`db:local:start` retournait alors sans erreur mais toutes les routes `/api/v1`
répondaient 503, empêchant la connexion et le chargement des espaces.

## Résultat

- le script déduit le nom du conteneur depuis le `project_id` Supabase ;
- après `supabase start`, il vérifie explicitement l'état de l'Edge Runtime ;
- un conteneur existant mais arrêté est redémarré sans reset de la base ;
- l'absence anormale du conteneur fait échouer le démarrage avec un message
  exploitable ;
- le script confirme enfin que le service API local est actif.

## Validation

- reproduction locale d'un Edge Runtime arrêté alors que la base restait saine ;
- garde-fou d'architecture sur la détection et le redémarrage ciblé ;
- exécution non destructive de `db:local:start`, puis probe API ;
- suite Vitest complète et typecheck.
