---
id: BCP-0c
epic: E10 — Gestion commerciale (correctif securite/cout)
status: done (implementation dev-story) — qa-review distincte requise avant merge
branch: agent-a8e2169631afd2048 (worktree isole, depuis feat/gescom-e10-4-entite-client @ f1f2b293)
depends_on: [BCP-0]
parallelisable_avec: [BCP-0b]
---
# BCP-0c — Reserver les diagnostics de plateforme a l administrateur de la plateforme

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **2.3ter**, et la
ligne BCP-0c du decoupage (~ligne 4885). Correctif de securite et de cout :
`GET /api/v1/diagnostics/clariprint` (appel `CheckAuth`, peut-etre facture) et
`GET /api/v1/diagnostics/ai` (appel Anthropic **certainement** facture)
etaient ouvertes a tout utilisateur connecte (`authentication: 'required'`,
aucun controle de role), alors que l inscription et la creation d un espace
sont en libre-service.

## Ce qui est livre

| Element | Detail |
|---|---|
| `src/modules/diagnostics/application/platform-admin-gateway.ts` (neuf) | Interface `PlatformAdminGateway.isPlatformAdmin(actor)`, meme patron que `AssistantAccessGateway.isTenantMember` deja en place dans le module. Ne definit aucune nouvelle regle : documente que la garde reelle est `public.is_super_admin()` (migration `20260424000100`). |
| `src/adapters/supabase/platform-admin-gateway.ts` (neuf) | `SupabasePlatformAdminGateway` — appelle `client.rpc('is_super_admin')`, EXACTEMENT le meme appel que `SupabaseCatalogRepository.assertPimAdmin` (`catalog-repository.ts:72`). Aucune reecriture TypeScript de la regle « espace systeme ». `client` est lie a l `Authorization` de la requete (comme partout dans `magrit-api/index.ts`), donc `auth.uid()` cote SQL resout le bon acteur. |
| `src/modules/diagnostics/application/diagnostics-service.ts` (modifie) | `DiagnosticsService` prend un 3e parametre `platformAdmin: PlatformAdminGateway`. `aiProvider(actor)` et `clariprint(actor)` appellent desormais `assertPlatformAdmin(actor)` **avant** tout appel a leur passerelle respective ; refus → `DiagnosticsAccessDeniedError`, **aucun** appel a `aiGateway`/`clariprintGateway`. `assertPlatformAdmin` est PUBLIQUE (meme discipline que `PriceRulesService.assertCanManagePricing`, E10.11). |
| `src/server/api/diagnostics-routes.ts` (modifie) | Les deux routes extraient l acteur (`context.actor.userId`, 403 `identity.user_actor_required` defensif si l acteur n est pas de type `user`), et retraduisent `DiagnosticsAccessDeniedError` en 403 `identity.role_required` (code deja publie, §3.5 regle 3) via `execute()`. |
| `supabase/functions/magrit-api/index.ts` (modifie) | Cablage de `new SupabasePlatformAdminGateway(client)` en 3e argument de `DiagnosticsService`. Import ajoute. |
| `src/modules/diagnostics/index.ts` (modifie) | Exporte le nouveau type `PlatformAdminGateway` et `DiagnosticsAccessDeniedError`, meme discipline que les autres gateways/erreurs du module. |
| `docs/architecture/api/openapi.yaml` (modifie, MEME COMMIT que le code) | Ajout d une reponse `403` sur `testAiProvider` et `testClariprint`, avec la phrase exigee par 2.3ter (« reserve a l administrateur de la plateforme (`is_super_admin()`) ») et la precision qu aucun appel sortant n est fait sur ce refus. `openapi/magrit-core.v1.yaml` **n a pas ete touche** — ces routes n y figurent pas et n y entrent pas. |
| `src/app/layouts/Header.tsx` (modifie) | Le bouton « Diagnostic des connexions API » n est rendu que si `useTenant().isSuperAdmin` est vrai (le front connait deja ce flag — `TenantContext.tsx`, deja consomme par `DashboardLayout`, `TenantAwareLayout`, etc.). Ergonomie seule : la vraie barriere reste le serveur. |
| `src/modules/diagnostics/ui/hooks/usePlatformDiagnostics.ts` (modifie) | `diagnosticRequestError()` detecte `cause instanceof ApiClientError && cause.problem.code === 'identity.role_required'` et rend « Reserve a l administrateur de la plateforme. » au lieu de `String(cause)` — meme discipline que `describeOrderFileUploadFailure` (`order-files.helpers.ts`) : discrimination par `problem.code`, jamais par inspection de message. Tout autre cas (reseau reel, autre 403) garde le comportement historique, inchange. |

## Tests

- `tests/server/diagnostics-routes.test.ts` (reecrit) — pour **chacune** des deux
  routes (`/diagnostics/ai`, `/diagnostics/clariprint`), via `describe.each` :
  - 403 `identity.role_required` pour un compte sans aucun espace, **zero**
    appel a la passerelle (compteur reel sur le faux `AiDiagnosticsGateway`/
    `ClariprintDiagnosticsGateway`, pas un commentaire) ;
  - 403 `identity.role_required` pour l owner d un espace ordinaire cree en
    libre-service, **zero** appel a la passerelle ;
  - 200 pour un administrateur de la plateforme, **exactement un** appel a la
    passerelle ;
  - le client navigateur (`DiagnosticsApiClient`) recoit une vraie
    `ApiClientError` avec `problem.status === 403` et
    `problem.code === 'identity.role_required'`.
  - Conserve le test d authentification (401 sans identite) et le test de
    partage de contrat (desormais joue avec un acteur administrateur).
- `tests/app/hooks/usePlatformDiagnostics.test.ts` (etendu) — `diagnosticRequestError`
  reecrit un 403 `identity.role_required` en message clair, et NE reecrit PAS
  un autre 403 (`auth.scope_forbidden` en contre-exemple) ni une erreur reseau
  generique (comportement historique inchange, deja teste).

**Preuve d echec sur l ancien code** (exigee par §8, methode point 2) :
chaque nouveau test de refus/comptage a ete rejoue contre l implementation
d avant BCP-0c (`diagnostics-service.ts`/`diagnostics-routes.ts` a 2 args,
sans passerelle d autorisation) via un `git stash` temporaire portant
uniquement les fichiers d implementation (tests et contrat inchanges). Sur
l ancien code, 5 tests echouent : les deux scenarios de refus (403 attendu)
recoivent un 200 avec la passerelle reellement appelee, et le test client
recoit la donnee au lieu d une `ApiClientError`. L implementation a ensuite
ete restauree (`git stash apply` par SHA, puis `git stash drop` de cette
seule entree — la pile de stash partagee du worktree n a pas ete touchee par
ailleurs).

## Ce qui n est PAS dans le perimetre

- **BCP-0b** (limiteur de chiffrage Clariprint) — aucun fichier commun, aucune
  dependance. Verifie negativement : `clariprint-routes.ts`, le service et le
  budget Clariprint, la migration de limite de debit n ont pas ete touches.
- **`openapi/magrit-core.v1.yaml`** — non touche, comme exige (ces routes n y
  figurent pas ; seul l architecte le modifie).
- **Aucun nouveau `data-testid`** — le masquage du bouton dans `Header.tsx`
  ne necessitait aucun testid nouveau (aucun Hint DOM ne le demandait), et
  aucun n a ete invente.
- **Aucun test de composant React** — le depot ne compte aucun fichier
  `.test.tsx` ni `@testing-library/react` : coherent avec le principe (b1)
  d E10.18e-1 (« le JSX ne fait que parcourir des fonctions pures testees »).
  La logique testable (`diagnosticRequestError`, la garde du service, le
  comptage d appels sortants) est couverte ; le JSX de `Header.tsx` se limite
  a un `&&` sur un flag deja fourni par un contexte existant et deja teste
  ailleurs.

## Deploiements necessaires (non faits par cet agent — aucun deploiement autorise)

- `magrit-api` (edge function) — porte la garde serveur, **prealable** a tout
  le reste (2.3ter, section Deploiements).
- Le front (statique) — porte le masquage du bouton et le message clair.
- Ordre impose par le cadrage : `magrit-api` PUIS le front.
