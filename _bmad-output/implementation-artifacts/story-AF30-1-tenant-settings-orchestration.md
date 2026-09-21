---
id: AF30.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF29.9]
---
# AF30.1 — Isoler l'orchestration des paramètres tenant

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `useTenantSettingsForm` porte l'état du formulaire, la validation du slug et
  la mutation du module Session ;
- le changement de tenant réinitialise les valeurs et les messages à partir du
  nouvel espace, y compris sans remontage du composant ;
- les droits de modification du nom et du slug restent fournis explicitement
  par la surface workspace ;
- `DashboardTenantSettings` ne connaît plus `useSessionApi` et reste une vue ;
- une sauvegarde réussie n'est pas requalifiée en échec si le rechargement du
  contexte rencontre ensuite une erreur.

## Validation

- garde-fou API-first adapté à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
