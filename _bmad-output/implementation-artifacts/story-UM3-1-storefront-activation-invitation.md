---
id: UM3.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.10]
---
# UM3.1 — Inviter un compte boutique à s’activer

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
