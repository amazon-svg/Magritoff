---
id: AF24.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.3]
---
# AF24.4 — Unifier le bootstrap Session en développement

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `SessionBootstrapContext` utilise toujours `SessionApiClient` ;
- suppression du client DEV qui instançait un repository Supabase dans le
  navigateur ;
- suppression du commutateur `VITE_API_RUNTIME`, devenu inutile ;
- le proxy same-origin `/api/v1` reste le seul point de variation entre une
  fonction Edge locale et une fonction Edge distante.

## Configuration

- local Docker :
  `VITE_API_PROXY_TARGET=http://127.0.0.1:54321/functions/v1/magrit-api` ;
- Supabase distant : renseigner la même variable avec l’URL de la fonction
  `magrit-api` distante, ou utiliser la cible distante par défaut de Vite.

Ce lot ne migre pas Supabase Auth : le navigateur doit encore maintenir la
session et fournir son jeton au client API. Cette dérogation est isolée dans
`browser-authentication-gateway.ts`.
