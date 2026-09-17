---
id: AF20.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF19.2]
---
# AF20.1 — Isoler la lecture de la gestion commerciale

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- module `commercial` et vue agrégée tenant-scoped ;
- règles de prix, groupes avec compteur, membres et gammes chargés en une seule
  requête applicative ;
- le cas de migration commerciale absente devient `available: false` dans le
  contrat au lieu d'exposer les codes PostgREST dans l'interface ;
- `commercial.helpers` redevient un moteur de calcul pur, sans accès réseau.

## Mesures

- dashboard commercial : **10 → 8** références Supabase ;
- helpers commerciaux : **2 → 0** références Supabase ;
- baseline globale : **20 → 16** références ;
- fichiers importeurs : **7 → 6**.

Les mutations sur les règles, groupes et membres sont réservées à AF20.2.

## Validation UX attendue

Ouvrir « Prix & marges » et vérifier le chargement des règles, groupes, membres
et gammes. Sur une base sans migration commerciale, l'état explicatif historique
doit rester affiché.
