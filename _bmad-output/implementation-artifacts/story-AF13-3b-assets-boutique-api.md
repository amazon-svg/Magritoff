---
id: AF13.3b
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.3a]
---

# AF13.3b — Isoler les visuels de marque des boutiques

## Résultat livré

- transport `multipart/form-data` générique dans le client et le serveur API ;
- endpoint authentifié d’upload des logos et images hero ;
- validation serveur du type MIME et de la limite de 5 Mo ;
- chemin, bucket et URL publique gérés uniquement par l’adaptateur Supabase ;
- migration complète de `DashboardShopEditor` hors du client Supabase.

## Invariants de sécurité

- le tenant, la boutique et l’acteur sont dérivés de la route et de la session ;
- la boutique doit appartenir au tenant demandé ;
- les politiques Storage continuent d’exiger `can_manage_catalog` ;
- seuls JPEG, PNG et WebP sont acceptés, entre 1 octet et 5 Mo.

## Mesures

- références directes dans l’éditeur : **2 → 0** ;
- baseline globale : **92 → 90** références ;
- fichiers UI important Supabase : **28 → 27**.

## Validation UX attendue

Depuis l’éditeur d’une boutique, importer successivement un logo puis un visuel
hero en PNG/JPEG/WebP, enregistrer la boutique et vérifier les deux rendus sur
la vitrine. Un SVG et une image dépassant 5 Mo doivent être refusés.
