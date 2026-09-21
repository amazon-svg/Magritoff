---
id: UM10.20
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.19]
---
# UM10.20 — Monter les identités par frontière de route

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Les runtimes storefront et workspace étaient autonomes, mais tous leurs
providers enveloppaient encore globalement le routeur. Visiter une boutique
initialisait donc toujours Supabase Auth Magrit, le bootstrap des espaces et les
contexts tenant, même si aucun composant boutique ne les consommait.

## Résultat

- `StorefrontRuntimeBoundary` monte uniquement runtime HTTP, gateways et
  clients storefront ;
- `WorkspaceRuntimeBoundary` monte Auth Magrit, runtime bearer, bootstrap,
  préférences, PIM et clients workspace ;
- les trois routes `/shop/:slug` sont placées sous la frontière storefront ;
- les routes d’accès Magrit, tenant et dashboard restent sous la frontière
  workspace puis `AppShell` ;
- `App.tsx` ne porte plus aucun contexte d’identité transversal.

## Validation

- garde-fou vérifiant l’absence d’Auth et des clients workspace dans la
  frontière storefront ;
- garde-fou vérifiant le montage Auth/bootstrap uniquement côté workspace ;
- typecheck, suite Vitest complète et build de production.
