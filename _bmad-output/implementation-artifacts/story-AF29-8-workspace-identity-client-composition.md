---
id: AF29.8
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.7]
---
# AF29.8 — Composer les clients d'identité workspace Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- Roles, Members et Invitations sont composés dans `ModuleClientsProvider` ;
- leurs clés et hooks portent explicitement le préfixe `workspace` ;
- les écrans utilisateurs, rôles et capabilities consomment les instances
  injectées ;
- la création d'invitation conserve une fabrique liée au JWT fraîchement
  renouvelé ;
- un garde-fou confine toutes les constructions au composition root.

Le vocabulaire `workspace` évite de présenter ces membres tenant comme des
comptes clients boutique. La séparation fonctionnelle stricte et le mécanisme
« se connecter comme » restent régis par la spécification dédiée et ne sont pas
implémentés par cette tranche de composition.
