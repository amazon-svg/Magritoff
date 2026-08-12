---
id: AF3.2
epic: EPIC-8-API-FIRST
priority: P0
status: review
branch: refactor/api-first-foundation
depends_on: [AF3.1]
---

# AF3.2 — Correctif création espace et bootstrap local

## Incident

La RPC crée correctement le tenant et son membership, mais le bootstrap Edge échoue ensuite avec `permission denied for table tenant_members`. Les migrations reposaient sur les anciens privilèges automatiques Supabase, alors que les nouveaux projets locaux révoquent les opérations Data API par défaut. Par ailleurs, `/tenants/new` restait accessible sans session et présentait une erreur de création générique.

## Critères d acceptation

1. Les rôles `anon` et `authenticated` reçoivent explicitement les opérations Data API ; les policies RLS restent la frontière d autorisation.
2. Les privilèges par défaut couvrent les futures tables et séquences.
3. Le bootstrap authentifié peut lire `tenant_members`, `tenants` et `user_preferences`.
4. Un utilisateur non connecté ne peut pas soumettre le wizard et revient au parcours de connexion.
5. Le parcours compte local → création espace → route tenant → dashboard est validé dans le navigateur.
6. Une session navigateur devenue orpheline après `db reset` est invalidée avant d ouvrir le wizard.
7. Un rechargement direct du dashboard attend le bootstrap du user avant toute redirection onboarding.

## Validation réalisée

- reset complet Supabase local avec la migration de grants : réussi ;
- compte local créé depuis l UI : réussi ;
- tenant, membership owner et préférences créés : réussis ;
- création espace → `/t/espace-corrige` : réussie ;
- rechargement direct → `/dashboard/quotes` : réussi ;
- page Gammes actives : 81 gammes chargées ;
- session orpheline après reset : invalidée et redirigée vers le parcours de connexion ;
- typecheck : réussi ;
- suite complète : 794 tests réussis, 87 ignorés ;
- build Vite de production : réussi.
