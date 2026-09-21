---
id: AF11.2
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF11.1]
---

# AF11.2 — Créer une invitation sans Edge Function imbriquée

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- commande SQL `api_create_tenant_invitation` accessible uniquement au rôle
  `authenticated` ;
- acteur dérivé exclusivement de `auth.uid()` ;
- contrôle `can_invite`, validation tenant des rôles et boutiques, idempotence
  des invitations actives et génération serveur du token ;
- repository utilisant la commande RPC avec le JWT utilisateur ;
- email initial envoyé par `InvitationEmailSender` puis l’adaptateur Resend ;
- suppression de toute invocation `invite-member` dans le code applicatif ;
- aucun service-role ajouté à `magrit-api`.

## Sémantique de panne

L’invitation est durablement créée avant l’appel au fournisseur email. Si
Resend est absent ou indisponible, l’API retourne `sent=false` et le lien
manuel. Cette stratégie évite un rollback distribué fragile ; un outbox
transactionnel pourra compléter ultérieurement la garantie de livraison.

## Validation

- garde-fous SQL sur identité, capability, rôles, boutiques et doublons ;
- garde-fou TypeScript interdisant `invite-member` et `functions.invoke` dans
  le repository Invitations ;
- typecheck modulaire, tests complets et build de production.
