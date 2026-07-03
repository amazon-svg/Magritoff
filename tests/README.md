# Tests Magrit B4

## RLS d etancheite multi-tenant (E9.10)

Tests vitest qui verifient qu un user authentifie via JWT anon ne peut pas
lire / modifier les donnees d un autre tenant.

### Variables d environnement requises

Creer `Magritoff-v4/.env.test` (NON commite, deja dans .gitignore via `.env*`) :

```
SUPABASE_URL=https://ightkxebexuzfjdbpsdg.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...     # anon, public
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # service_role, dashboard Supabase > Settings > API
```

### Lancer

```
pnpm test
```

Si une variable manque, les tests sont marques `skipped` (pas `failed`).

### Ce qui est teste

- `tenant_members` : userA ne lit pas les memberships de tenantB, mais lit ses propres
- `tenant_invitations` : userA ne lit pas + ne cree pas d invitation cote tenantB
- `tenants` : userA ne renomme pas tenantB
- `llm_usage_events` : userA ne lit pas la conso LLM de tenantB

### Nettoyage

Le `afterAll` supprime tous les artefacts crees (users, tenants, memberships).
Si un test crash en cours, lancer manuellement :

```sql
delete from tenants where slug like 'rls-test-%';
-- supprimer les users via dashboard Supabase > Authentication > Users
```
