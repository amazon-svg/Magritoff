---
id: AF27.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.1]
---
# AF27.2 — Injecter le fournisseur Auth depuis le runtime navigateur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `AuthProvider` dépend uniquement du contrat `AuthenticationGateway` ;
- passerelle injectée explicitement par `App` ;
- nouveau composition root `platform/runtime/browser-runtime` ;
- adaptateur Supabase instancié uniquement derrière ce runtime ;
- garde-fou d'architecture interdisant désormais toute importation d'un
  adaptateur Supabase depuis `src/app`.

Cette tranche supprime la dernière dépendance fournisseur de l'UI. Supabase
reste une implémentation d'authentification interchangeable dans les
adaptateurs ; remplacer ce fournisseur ne demande plus de modifier un contexte
React ou un écran.
