---
id: ADR-2026-10-01-C1
title: Exécution côté serveur sans fonctions Edge Supabase
date: 2026-10-01
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-01-ATELIER
owners: []
supersedes: []
affectedArtifacts:
  - apps/
  - packages/
---

# Exécution côté serveur sans fonctions Edge Supabase

## Décision

L'architecture cible n'utilise plus de fonctions Edge Supabase. Le code et les tests de la branche principale apportent la preuve du comportement effectivement livré.
