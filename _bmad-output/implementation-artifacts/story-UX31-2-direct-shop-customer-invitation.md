# Story UX31.2 — Invitation directe d’un client boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

**Statut :** done  
**Date :** 2026-08-20

## Problème

L’administrateur devait créer un compte avec un nom et un email, puis retrouver
ce compte dans la liste et lancer une seconde action « Inviter ». Cette distinction
entre préparation métier et activation était utile techniquement mais inutilement
visible dans le parcours principal.

## Parcours retenu

1. L’administrateur saisit uniquement l’email du client.
2. Il clique sur « Envoyer l’invitation ».
3. Magrit crée le compte boutique s’il n’existe pas, puis émet immédiatement le
   lien d’activation et tente l’envoi de l’email.
4. Si l’email ne peut pas être envoyé, le lien manuel reste affiché et copiable.
5. Si le compte était déjà préparé ou invité, la même action renvoie l’invitation.

Le compte reste strictement attaché au couple `(boutique, email)` et ne devient
jamais un utilisateur Magrit. Son nom d’affichage initial est déduit de la partie
locale de l’email sans ajouter de champ au parcours d’invitation.

## Critères d’acceptation

- [x] Aucun nom n’est demandé pour inviter un client.
- [x] Une seule soumission prépare le compte et génère son activation.
- [x] Un compte déjà actif ou suspendu reçoit un message explicite.
- [x] Le renvoi d’une invitation existante ne crée pas de doublon.
- [x] Le lien manuel reste disponible lorsque l’email n’est pas délivré.
