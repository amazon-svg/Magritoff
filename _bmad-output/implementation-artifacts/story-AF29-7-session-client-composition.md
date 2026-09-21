---
id: AF29.7
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.6]
---
# AF29.7 — Composer la façade Session Magrit dans un root unique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `ModuleClientsProvider` crée l'unique façade Session de l'application ;
- bootstrap, paramètres tenant, sous-espaces, redirection de slug et acceptation
  d'invitation consomment l'instance injectée ;
- ces écrans ne construisent plus de façade depuis le transport HTTP ;
- un garde-fou confine le constructeur au composition root.

Cette façade concerne la session workspace Magrit existante. Elle ne définit
pas le futur modèle d'authentification des clients boutique, dont les comptes
restent strictement propres à chaque boutique selon la spécification dédiée.
