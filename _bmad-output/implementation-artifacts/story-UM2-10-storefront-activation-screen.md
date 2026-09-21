---
id: UM2.10
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.9]
---
# UM2.10 — Permettre au client d’activer son compte

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- façade HTTP storefront anonyme, distincte du client workspace authentifié ;
- écran public `/shop/{slug}/activate?token=...` ;
- saisie et confirmation d’un mot de passe propre à la boutique ;
- message d’échec neutre pour les jetons inconnus, expirés ou consommés ;
- aucun accès Supabase direct dans l’écran ;
- redirection vers la boutique après activation réussie.

Le prochain lot UM3 peut désormais envoyer un lien réellement utilisable.
Depuis UM2.11, la validation du mot de passe ouvre atomiquement une session
storefront distincte et la redirection donne immédiatement accès à la boutique.
