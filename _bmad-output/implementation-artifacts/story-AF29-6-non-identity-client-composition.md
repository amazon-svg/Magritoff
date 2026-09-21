---
id: AF29.6
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.5]
---
# AF29.6 — Composer les derniers clients hors identité

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- les façades Conversations, Commercial et Diagnostics sont créées dans
  `ModuleClientsProvider` ;
- l'historique conversationnel et la gestion commerciale utilisent leurs
  instances injectées ;
- le panneau de diagnostic et le catalogue boutique partagent la même façade
  Diagnostics ;
- un garde-fou confine les trois constructeurs au composition root.

Cette tranche termine la centralisation des clients sans dépendance au modèle
d'identité. Session, Roles, Members et Invitations restent réservés au chantier
fonctionnel séparant strictement les utilisateurs Magrit des comptes boutique.
