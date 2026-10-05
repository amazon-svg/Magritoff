---
id: ADR-2026-10-01-C2
title: Socle de développement local
date: 2026-10-01
documentStatus: draft
decisionStatus: adopted
source: MEET-2026-10-01-ATELIER
owners: []
supersedes: []
affectedArtifacts:
  - docker-compose.yml
  - scripts/
---

# Socle de développement local

## Décision

Le développement local s'appuie sur PostgreSQL, un stockage objet compatible S3 et Mailpit, installés en conteneurs par les scripts du dépôt.
