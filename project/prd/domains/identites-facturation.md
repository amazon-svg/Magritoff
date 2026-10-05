---
id: DOMAIN-IDENTITIES-BILLING
title: Identités, accès et données de facturation
documentStatus: draft
owner: unassigned
source: _bmad-output/planning-artifacts/prd-entites-juridiques-facturation-boutiques.md
supersedes: []
decisions:
  - PD-2026-10-01-B3
---

# Identités, accès et données de facturation

## Finalité

Séparer clairement les utilisateurs Magrit, les comptes clients boutique, les entités juridiques et les partenaires autorisés, tout en conservant la traçabilité des actions.

## Principes consolidés

- un compte client peut représenter une ou plusieurs entités juridiques de facturation ;
- les informations utilisées sur une commande sont copiées et figées ;
- une modification ultérieure du profil ne réécrit pas l'historique ;
- les accès externes sont explicites, limités et révocables ;
- un sous-traitant conserve la maîtrise de son parc et de ses données ;
- une action en délégation trace le compte client et l'utilisateur Magrit qui agit.

## Questions ouvertes

- obligation d'un identifiant d'entreprise lors de la création d'un client ;
- rattachement entre sous-espace et parc machines : `OQ-B3-PARC` ;
- capacité d'un groupe à administrer les données de ses filiales ;
- validations externes SIREN et TVA.

## Provenance détaillée

Le PRD historique spécialisé reste disponible à son emplacement BMAD. Ses règles détaillées demeurent `draft` tant qu'elles ne sont pas transformées en fonctionnalités et stories approuvées.
