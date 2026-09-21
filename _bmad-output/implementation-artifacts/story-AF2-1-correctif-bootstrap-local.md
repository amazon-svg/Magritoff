---
id: AF2.1
epic: EPIC-8-API-FIRST
priority: P0
status: review
branch: refactor/api-first-foundation
depends_on: [AF2]
---

# AF2.1 — Correctif bootstrap local et accès dashboard

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Incident

En environnement Vite, `window.fetch` est stocké comme méthode du client API puis invoqué avec le mauvais receveur. Le bootstrap lève `Can only call Window.fetch on instances of Window`. Même corrigé, le développement local dépendrait de la fonction Edge `magrit-api` non encore déployée.

## Critères d acceptation

1. Le client fetch conserve le receveur global attendu par les navigateurs.
2. Un test de régression échoue si la fonction fetch est appelée avec le client API comme `this`.
3. En mode DEV par défaut, le bootstrap utilise le même `SessionService` et le repository RLS avec la session Supabase existante, sans dépendre du déploiement Edge.
4. En production, toutes les lectures restent sur `/api/v1/session` ; aucun fallback direct silencieux n est permis.
5. Le mode Edge peut être forcé localement avec `VITE_API_RUNTIME=edge` pour la recette d intégration.
6. La création d un espace suivie du `reload()` hydrate le nouveau tenant et permet la navigation vers `/t/:slug`.
7. L absence temporaire de `tenant_gamme_subscriptions` reste non bloquante et est signalée comme dégradation, pas comme échec de création.

## Plan de test

- test receveur fetch ;
- tests client DEV session ;
- architecture, suite complète et build ;
- smoke local authentifié création espace → dashboard.

## Implémentation

- `FetchApiClient` lie explicitement l implémentation de `fetch` au global navigateur ;
- le bootstrap DEV réutilise `SessionService` et `SupabaseSessionRepository` avec la session RLS courante ;
- `VITE_API_RUNTIME=edge` conserve la possibilité de tester la fonction Edge localement ;
- l absence de `tenant_gamme_subscriptions` est traitée comme une capacité optionnelle.

## Validation

- tests ciblés : 14 réussis ;
- tests architecture : 10 réussis ;
- suite complète : 789 réussis, 87 ignorés ;
- typecheck et build Vite de production : réussis ;
- bundle de production : aucun symbole du client session DEV ;
- smoke authentifié création espace → dashboard : à confirmer par la recette UX.
