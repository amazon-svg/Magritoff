---
id: AF27.6
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.5]
---
# AF27.6 — Injecter la passerelle Mockups

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- la passerelle Mockups est composée par le runtime navigateur ;
- `MockupImage` et `DashboardAdminMockups` consomment le contrat injecté ;
- l'UI ne connaît plus `browserMockupGateway` ni son protocole HTTP concret ;
- le garde-fou d'architecture est généralisé : aucun fichier de `src/app` ne
  peut importer directement un adaptateur `supabase` ou `http`.

## Jalon d'architecture

À l'issue de cette tranche, `src/app` ne contient plus aucun import d'adaptateur
concret. Les fournisseurs sont composés sous `src/platform/runtime`, puis
injectés sous forme de contrats métier. Le front peut encore instancier les
clients de modules `/api/v1` à partir du transport partagé ; il ne choisit plus
les implémentations fournisseur.
