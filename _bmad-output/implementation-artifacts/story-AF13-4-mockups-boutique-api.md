---
id: AF13.4
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.3b]
---

# AF13.4 — Isoler les mockups personnalisés des boutiques

## Résultat livré

- lecture, upload multipart et restauration via le module Shops ;
- tenant, boutique, template, vue et horodatage contrôlés côté serveur ;
- Storage et `shop_template_mockups` confinés à l’adaptateur Supabase ;
- overrides inclus dans le catalogue après son garde d’accès ;
- résolution synchrone dans les cartes et l’overlay, sans requête N+1 ;
- aperçu back-office aligné sur les visuels Magrit P18 du portail.

## Invariants de sécurité

- aucun override n’est chargé avant l’autorisation du catalogue ;
- l’administration exige une session et conserve les contrôles RLS ;
- seuls PNG, JPEG, WebP et SVG sont acceptés, jusqu’à 5 Mo ;
- les paramètres template et vue sont validés par les contrats Magrit.

## Mesures

- références Supabase du périmètre : **6 → 0** ;
- baseline globale : **90 → 84** références ;
- fichiers UI important Supabase : **27 → 25** ;
- une seule lecture catalogue remplace les requêtes par carte et overlay.

## Validation UX attendue

Dans l’éditeur d’une boutique, téléverser puis remplacer un mockup custom,
ouvrir le catalogue et la fiche du produit concerné, puis restaurer le visuel
Magrit. Vérifier également le refus d’un fichier de plus de 5 Mo.
