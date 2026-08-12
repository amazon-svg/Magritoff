---
id: AF20.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF19.2]
---
# AF20.1 — Isoler la lecture de la gestion commerciale

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
