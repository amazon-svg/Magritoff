---
id: AF26.9
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.8]
---
# AF26.9 — Déclarer la sortie workspace de Tenants

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- nouveau manifeste métier `tenants` pour les espaces Magrit ;
- features et capabilities distinctes pour les paramètres et les sous-espaces ;
- routes lazy « Paramètres de l'espace » et « Sous-espaces » fournies par le
  registre de surfaces ;
- navigation Paramètres alimentée par la contribution du module ;
- suppression des déclarations correspondantes dans `routes.tsx`.

Les deux écrans utilisent encore `SessionApiClient` pour leurs commandes. Ce
choix est explicitement transitoire : la composition de surface appartient à
`tenants`, tandis que l'extraction des contrats tenant hors du module technique
`session` reste une future tranche interne sans incidence sur les URLs ou l'UX.
