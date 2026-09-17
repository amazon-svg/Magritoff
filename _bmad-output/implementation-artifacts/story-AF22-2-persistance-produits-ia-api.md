---
id: AF22.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF22.1]
---
# AF22.2 — Isoler la persistance des produits IA

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- commande Shops `/api/v1/tenants/{tenantId}/shops/{shopId}/ai-products` ;
- validation contractuelle du produit calculé et de sa signature ;
- acteur dérivé du bearer et rattachement boutique/tenant vérifié avant RPC ;
- comportement best-effort conservé dans le portail : un échec de persistance
  ne masque jamais les résultats IA déjà calculés ;
- dernière dépendance Supabase retirée de `src/app`.

## Mesures

- portail : **1 → 0** référence Supabase ;
- baseline globale : **1 → 0** référence ;
- fichiers importeurs dans `src/app` : **1 → 0** ;
- URLs Edge directes dans `src/app` : **0**.

## Validation UX attendue

Lancer une recherche IA authentifiée dans une boutique, vérifier l'affichage
immédiat des résultats puis leur présence après rechargement. Rejouer la même
recherche : la signature doit dédupliquer le produit. Une erreur de persistance
ne doit pas casser la recherche ni le calcul du prix.

## Évolution UM10.1

Cette persistance concernait l’ancien acheteur porté par une identité Magrit.
Avec les comptes boutique séparés, une recherche client ne reçoit plus le droit
Magrit de modifier durablement le catalogue. Les suggestions restent
éphémères et commandables ; leur publication permanente relève du back-office.
