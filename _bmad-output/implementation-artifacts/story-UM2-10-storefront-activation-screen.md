---
id: UM2.10
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.9]
---
# UM2.10 — Permettre au client d’activer son compte

- façade HTTP storefront anonyme, distincte du client workspace authentifié ;
- écran public `/shop/{slug}/activate?token=...` ;
- saisie et confirmation d’un mot de passe propre à la boutique ;
- message d’échec neutre pour les jetons inconnus, expirés ou consommés ;
- aucun accès Supabase direct dans l’écran ;
- redirection vers la boutique après activation réussie.

Le prochain lot UM3 peut désormais envoyer un lien réellement utilisable. La
connexion automatique n’est volontairement pas implicite : le mot de passe est
activé, puis une session storefront distincte pourra être ouverte.
