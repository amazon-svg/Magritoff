---
id: UM2.1
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.4]
---
# UM2.1 — Poser la frontière de session storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-152](https://app.notion.com/3c6d0131973c81df8252fc0a6936848b) | P12 — Un compte par boutique : même email = deux comptes, une session ne vaut que pour sa boutique | OK | P0 — Critique | P12 — Comptes clients boutique | B5 | SPEC-IDENTITY-STORE-01, UM1-1, UM2-1, UM10-4, invariant 3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- contrats de connexion et de session propres au module `shop-customers` ;
- invariants liant toujours l’identité, le profil et la même boutique ;
- profil storefront minimal sans `auth_subject_id` ni données workspace ;
- résultat JSON sans mot de passe, jeton ou identifiant Auth technique ;
- politique de cookie opaque `HttpOnly`, `SameSite=Lax`, `Path=/` ;
- cookie `__Host-` et `Secure` en production, nom local explicite en HTTP ;
- durée maximale de 24 heures et suppression par la même politique.

## Non livré dans cette story

- aucune route publique de connexion n’est activée ;
- aucun stockage de credential ou de session n’est choisi ;
- le checkout actuel n’est pas encore basculé ;
- la protection contre le brute force et la rotation sont obligatoires dans la
  story qui activera la route.

Cette séparation permet de choisir et tester le stockage serveur sans modifier le
contrat visible du navigateur.
