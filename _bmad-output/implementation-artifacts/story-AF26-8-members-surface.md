---
id: AF26.8
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.7]
---
# AF26.8 — Déclarer la sortie workspace de Members

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- manifeste du module Members, adossé au service API existant ;
- feature et capability d'administration des membres Magrit du tenant ;
- route lazy et navigation « Utilisateurs » fournies par le registre ;
- conservation du `data-testid` de navigation pour la recette existante ;
- suppression de la déclaration correspondante dans `routes.tsx`.

L'écran orchestre encore les modules Invitations et Roles et conserve
temporairement le modèle brownfield `shop_only`. Cette tranche ne transforme
pas ces membres en comptes boutique : la séparation stricte des identités et
le mécanisme « se connecter comme » restent régis par la spécification dédiée
`spec-identites-magrit-et-comptes-boutique.md`.
