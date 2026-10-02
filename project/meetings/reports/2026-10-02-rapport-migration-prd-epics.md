---
id: REPORT-2026-10-02-PRD-EPICS
title: Rapport de consolidation des PRD et epics BMAD
date: 2026-10-02
status: draft
source: MEET-2026-10-01-ATELIER
---

# Rapport de consolidation des PRD et epics BMAD

## Périmètre

Ce passage traite les trois premières actions d'assainissement documentaire :

1. expliciter le statut de `_bmad-output/` ;
2. neutraliser l'ancien emplacement `guidelines/` ;
3. consolider les PRD et l'epic explicitement actif.

## Résultats

- ajout d'un README de statut à `_bmad-output/` ;
- transformation de `guidelines/Guidelines.md` en redirection sans autorité ;
- marquage des PRD et du catalogue d'epics BMAD comme historiques ;
- consolidation de la vision, du périmètre et des principes dans `project/prd/` ;
- initialisation de cinq domaines fonctionnels ;
- migration de E10 Gestion commerciale comme unique epic explicitement actif ;
- création de six fonctionnalités de regroupement E10 ;
- classement des epics 0 à 8 sans recréation des chantiers clos, absorbés ou jamais démarrés.

## Méthode

Les contenus n'ont pas été copiés intégralement. Les règles durables ont été synthétisées, tandis que les éléments suivants ont été écartés de la source canonique :

- choix techniques Supabase rendus obsolètes par la nouvelle architecture ;
- branches, versions et échéances historiques ;
- statuts de livraison non prouvés ;
- objectifs chiffrés non revalidés ;
- fonctionnalités candidates jamais démarrées.

## Limites

- aucune story historique n'a été déplacée ;
- les statuts E10 restent à rapprocher du code et des tests ;
- les fonctionnalités E10 sont des regroupements documentaires `draft`, pas des approbations ;
- les epics candidats 5 et 6 ne sont pas réactivés ;
- les PRD consolidés doivent être relus par l'autorité produit.

## Prochain passage recommandé

Migrer les stories E10 depuis les sources Git et le futur export Notion, puis relier chaque story aux six fonctionnalités créées et aux preuves d'implémentation existantes.
