---
id: AF17.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF17.1]
---

# AF17.2 — Centraliser la session fraîche des invitations

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- ajout de `refreshSession` au contrat de `AuthContext` ;
- suppression de l’import Supabase dans `InviteUserModalV2` ;
- conservation de l’appel contractuel à `InvitationsApiClient` avec un bearer
  token rafraîchi juste avant la commande ;
- garde-fou d’architecture empêchant le retour d’un accès fournisseur dans la
  modale.

## Invariants

- le fournisseur d’identité reste confiné dans `AuthContext` ;
- la gateway reçoit une session fraîche avant `POST /api/v1/invitations` ;
- une session expirée conserve le message invitant l’administrateur à se
  reconnecter ;
- l’envoi effectif et le lien manuel de secours restent sous la responsabilité
  du module Invitations.

## Mesures

- `InviteUserModalV2` : **1 → 0** import Supabase ;
- baseline globale : **53** références directes inchangées ;
- fichiers UI important Supabase : **13 → 12**.

## Validation UX attendue

Depuis Utilisateurs, ouvrir la modale et envoyer une invitation avec une
session valide : l’email ou le lien manuel doit être présenté comme avant.
Avec une session expirée, la commande doit s’arrêter avec le message de
reconnexion, sans requête directe Supabase émise par la modale.
