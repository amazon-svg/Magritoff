---
id: AF7.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF7.1]
---

# AF7.2 — Fiabiliser l’invitation avec une session Edge valide

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Incident

Le formulaire « Inviter un utilisateur » affichait seulement « Edge Function
returned a non-2xx status code ». L’Edge Runtime local montrait que la gateway
rejetait un JWT expiré avant l’exécution de `invite-member`. Aucun enregistrement
orphelin n’était créé.

## Correction

- rafraîchissement explicite de la session avant l’invocation ;
- header `Authorization` construit avec le nouveau token ;
- `invited_by` dérivé de la session vérifiée et non d’une prop UI ;
- lecture du corps d’erreur de l’Edge Function ;
- messages actionnables pour session expirée, doublon, capability absente,
  rôle d’un autre tenant et payload invalide ;
- baseline Supabase du composant réduite de 3 à 2 références directes.

## Validation

- 4 tests unitaires de traduction d’erreurs ;
- garde-fou API-first ;
- typecheck modulaire et build de production.
