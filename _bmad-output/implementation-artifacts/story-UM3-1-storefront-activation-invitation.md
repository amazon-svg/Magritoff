---
id: UM3.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.10]
---
# UM3.1 — Inviter un compte boutique à s’activer

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-150](https://app.notion.com/3c6d0131973c81fabd65fe5dff0ce15d) | P12 — Inviter un client boutique depuis l éditeur, activer le compte, session immédiate | À jouer | P0 — Critique | P12 — Comptes clients boutique | B5 | UM1-1..4, UM2-8..11, UM3-1, AF30-15, UX31-2 |
| [TF-158](https://app.notion.com/3c6d0131973c81e680edf7450511d780) | P12 — Renvoyer une invitation client boutique et lien manuel sans Resend | À jouer | P1 — Importante | P12 — Comptes clients boutique | B5 | UM2-9, UM3-1, AF30-15 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- port de notification propre aux comptes boutique, séparé des invitations des
  utilisateurs Magrit ;
- adaptateur Resend appelé directement par `magrit-api`, sans Edge Function
  imbriquée ni appel Supabase Auth ;
- lien construit côté serveur vers `/shop/{slug}/activate?token=...` ;
- email destinataire et identité de boutique relus sous les droits workspace ;
- bouton « Inviter » / « Renvoyer » dans la liste des comptes de la boutique ;
- lien manuel toujours retourné et affiché, y compris après un envoi réussi ;
- absence de clé ou panne Resend non bloquante, avec motif explicite et copie du
  lien ;
- un nouvel envoi invalide automatiquement le jeton d’activation précédent.

## Configuration

- `RESEND_API_KEY` active l’envoi réel ;
- `MAGRIT_FROM_EMAIL` définit l’expéditeur et doit utiliser un domaine autorisé
  par Resend ;
- sans clé, le parcours reste testable intégralement grâce au lien manuel.

La création d’un compte reste distincte de son invitation : elle ne déclenche
aucun email implicite. UM3.2 pourra traiter la récupération de mot de passe avec
les mêmes invariants de confidentialité.
