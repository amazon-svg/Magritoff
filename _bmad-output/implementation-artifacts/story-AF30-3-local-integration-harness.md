---
id: AF30.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.2, UM9.1]
---
# AF30.3 — Réactiver le harnais d'intégration Supabase local

## Problème

Les tests dépendant de Supabase étaient ignorés sans `.env.test`. Une fois le
fichier fourni, ils ont révélé que `service_role` ne possédait plus les droits
de données attendus sur `public`, puis que plusieurs scénarios construisaient
encore des profils mixtes `auth.users` + `tenant_members.shop_only`.

## Résultat livré

- les privilèges DML et séquences de `service_role` sont versionnés pour les
  tables publiques, sans accès au schéma `private` ;
- les privilèges par défaut couvrent les futures tables et séquences publiques ;
- les tests de rôles et invitations Magrit utilisent uniquement des rôles
  back-office et le scope `magrit_full` ;
- l'ancien RPC `self_register_shop_buyer` est vérifié comme révoqué ;
- les tests storefront créent désormais un `shop_customer_account`, un
  credential et une session opaque, sans `auth.users` ni `tenant_member` ;
- le smoke commande appelle `api_create_storefront_order` et vérifie
  l'attribution au compte boutique.

## Exploitation locale

`.env.test` doit contenir les trois variables serveur du Supabase ciblé :
`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Le fichier
reste ignoré par Git et doit être limité aux permissions du propriétaire
(`chmod 600 .env.test`). Une stack locale s'initialise avec
`pnpm db:local:start`, puis `pnpm db:local:push`.

## Validation

- migrations locales appliquées sans reset destructif ;
- 160 fichiers de tests passés ;
- 1 208 tests passés, 0 ignoré, 0 échec.
