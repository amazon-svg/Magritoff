---
id: AF2
epic: EPIC-8-API-FIRST
sprint: AF-A
priority: P0
effort: L
status: review
branch: refactor/api-first-foundation
depends_on: [AF1]
unblocks: [AF3]
---

# AF2 — Bootstrap session, tenant et préférences

## User story

En tant qu utilisateur Magrit authentifié, je veux recevoir en un seul bootstrap mes tenants accessibles et mes préférences, afin que le navigateur ne reconstruise plus la session applicative par des lectures directes Supabase.

## Critères d acceptation

1. **Given** un bearer token valide, **when** `GET /api/v1/session` est appelé, **then** la réponse agrège identité minimale, tenants directs et hérités, super-administration et préférences.
2. **Given** un utilisateur non authentifié, **when** le bootstrap est appelé, **then** la façade retourne 401 sans lire les données métier.
3. **Given** un parent accessible, **when** le rôle est owner ou admin avec scope `magrit_full`, **then** ses enfants sont inclus avec les permissions héritées historiques.
4. **Given** un membership member, partner ou `shop_only`, **when** le bootstrap est construit, **then** aucun sous-tenant n est hérité.
5. **Given** `TenantContext` et `PreferencesContext`, **when** la session Auth change, **then** un bootstrap partagé alimente les deux contexts sans double appel.
6. **Given** une préférence ou un dernier tenant modifié, **when** le front persiste ce changement, **then** il passe par `/api/v1` et le cache de bootstrap est réconcilié.
7. Les mutations tenant historiques non incluses dans le bootstrap sont explicitement isolées comme dérogation de coexistence ; aucune lecture de `tenant_members`, `tenants` ou `user_preferences` ne subsiste dans les contexts React.
8. L adaptateur serveur utilise le JWT utilisateur et conserve les politiques RLS ; aucun service role n est utilisé pour le bootstrap.
9. La baseline Supabase UI diminue et les contrats HTTP ne réexportent aucun type PostgreSQL ou Supabase.
10. Le déploiement est ordonné backend puis front ; le front utilise exclusivement les chemins logiques même origine `/api/v1`.

## Découpage technique

- [x] Définir le module `session` : contrats, ports, règles d héritage et cas d usage.
- [x] Ajouter les routes GET session, PATCH préférences et PUT dernier tenant.
- [x] Implémenter l adaptateur Supabase Edge avec client JWT soumis à RLS.
- [x] Ajouter le composition root Edge `magrit-api` et le routage local `/api/v1`.
- [x] Introduire un provider de bootstrap partagé après `AuthProvider`.
- [x] Migrer `TenantContext` et `PreferencesContext` vers le client API.
- [x] Isoler et documenter les commandes tenant brownfield restantes.
- [x] Réduire la baseline exacte dès que les appels disparaissent.
- [x] Tester règles d héritage, contrats, cache partagé et non-régression contexts.
- [x] Documenter le runbook backend-first et préparer le TF AF2.

## Ordre de mise en production

1. Déployer et vérifier la fonction Edge `magrit-api`.
2. Configurer le reverse proxy hôte pour conserver `/api/v1` même origine.
3. Vérifier le contrat session avec un JWT RLS de test.
4. Déployer le front migré.
5. Surveiller les 401/5xx corrélées par `requestId` et conserver un rollback front indépendant.

## Plan de test

- `pnpm typecheck`
- `pnpm test:architecture`
- tests unitaires module session et repository simulé
- tests handler/client sans réseau
- `pnpm test`
- `pnpm build`

## Dérogation de coexistence

Supabase Auth reste dans `AuthContext` jusqu à la story de sortie dédiée. Les commandes de création de tenant, activation de gammes et acceptation d invitation restent exécutées par le navigateur, mais elles sont sorties du context React et confinées dans `src/adapters/supabase/legacy-tenant-commands.ts`. Les lectures de bootstrap et les écritures de préférences passent toutes par `/api/v1`.

## Résultat de validation

- `pnpm typecheck` : vert sur le périmètre strict modulaire.
- Tests ciblés session/API : verts.
- Tests d architecture : 6/6 verts.
- Régression complète : 780 tests verts, 87 ignorés.
- Build Vite : vert ; warning de taille du chunk principal toujours présent.
- Baseline Supabase UI : 45 → 43 fichiers importeurs et 83 → 70 références directes.
- La fonction Edge et le reverse proxy ne sont pas déployés : action externe backend-first documentée, soumise à confirmation.
