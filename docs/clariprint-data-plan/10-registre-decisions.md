# Registre des décisions Clariprint Data

Ce registre évite que les hypothèses du PRD deviennent silencieusement des contraintes techniques. Une décision structurante doit ensuite être détaillée dans un ADR si nécessaire.

## Statuts

- `ouverte` : réponse nécessaire ;
- `proposée` : solution formulée, validation attendue ;
- `acceptée` : décision applicable ;
- `reportée` : hors jalon actuel avec date de réexamen ;
- `remplacée` : une décision plus récente fait foi.

## Décisions métier et produit

| ID | Décision | Statut | Responsable | Jalon requis | Réponse / ADR |
|---|---|---|---|---|---|
| DEC-001 | Format actuel d'entrée du solveur | Ouverte | À nommer | J0 | — |
| DEC-002 | Snapshot complet, différentiel ou les deux | Ouverte | À nommer | J0 | — |
| DEC-003 | Familles de machines et flux pilote | Ouverte | À nommer | J0 | — |
| DEC-004 | Paramètres économiques consommés | Ouverte | À nommer | J0 | — |
| DEC-005 | Clariprint Data possède les profils et politiques, applique les ajustements et génère le JSON ajusté | Remplacée | Product Owner | J0 | Remplacée par [DEC-025](#décisions-métier-et-produit) |
| DEC-006 | Erreurs bloquantes et avertissements | Ouverte | À nommer | J0 | — |
| DEC-007 | Seconde validation technique ou financière | Ouverte | À nommer | J0 | — |
| DEC-008 | Portée multi-sites du MVP | Ouverte | À nommer | J0 | — |
| DEC-009 | Profondeur de sous-traitance | Proposée : un niveau | À nommer | J0 | — |
| DEC-010 | Unités et conventions d'arrondi | Ouverte | À nommer | J0 | — |
| DEC-011 | Volumétrie cible | Ouverte | À nommer | J0 | — |
| DEC-012 | Politique de conservation | Ouverte | À nommer | J5 | — |
| DEC-013 | Destination des exports sandbox | Ouverte | À nommer | J6 | — |
| DEC-014 | Correspondance tenant, BU et sous-tenant existant | Ouverte | À nommer | J0 | [Analyse PrintMaster](./11-analyse-source-printmaster.md) |
| DEC-015 | Nature de `PrinterEnvironment` : agrégat, vue ou périmètre de dataset | Ouverte | À nommer | J0 | [Analyse PrintMaster](./11-analyse-source-printmaster.md) |
| DEC-016 | Fournisseur unique multi-capacités avec environnements spécialisés | Proposée | À nommer | J0 | [PRD 0.6](../../prd/clariprint-data-prd.md) |
| DEC-017 | Une restauration crée un nouveau brouillon sans écraser l'historique | Proposée | À nommer | J5 | [Publications](../architecture/specifications/modules/clariprint-data/capabilities/publications.md) |
| DEC-018 | Délégation par identité vérifiée et grant temporaire, pas par lien seul | Proposée | À nommer | J1 | [Autorisations](../architecture/specifications/modules/clariprint-data/authorization.md) |
| DEC-019 | Famille matière textuelle et type de matière contrôlé | Proposée | À nommer | J3 | [Référentiels matière](../architecture/specifications/modules/clariprint-data/capabilities/material-references.md) |
| DEC-020 | Moteur officiel et priorité des barèmes | Ouverte | À nommer | J0 | [Barèmes](../architecture/specifications/modules/clariprint-data/capabilities/pricing-schedules.md) |
| DEC-021 | Référentiels canoniques machines, supports, prestations et certifications | Ouverte | À nommer | J0 | [Analyse PrintMaster](./11-analyse-source-printmaster.md) |
| DEC-022 | Module propriétaire des projets et résultats de validation | Ouverte | À nommer | J0 | [Projets de validation](../architecture/specifications/modules/clariprint-data/capabilities/validation-projects.md) |
| DEC-023 | Périmètre fonctionnel fr/en du MVP | Ouverte | À nommer | J0 | [PRD 0.6](../../prd/clariprint-data-prd.md) |
| DEC-024 | Main-d'œuvre, frais généraux et énergie comme entrées solveur | Ouverte | À nommer | J0 | [Analyse PRD initial](./13-analyse-prd-initial-printflow.md) |
| DEC-025 | Clariprint Data gère exclusivement les coûts de production ; marges, majorations, remises et prix de vente relèvent d'un module distinct | Acceptée | Product Owner | J0 | Arbitrage confirmé le 10 août 2026 ; [CR RP#070826](../cr-reunions/CR_RP070826_Magrit_IA.md) |
| DEC-026 | Authentification renforcée pour les actions sensibles | Ouverte | À nommer | J1 | [Analyse PRD initial](./13-analyse-prd-initial-printflow.md) |
| DEC-027 | Héritage pays, devise et unités entre BU et environnement | Ouverte | À nommer | J0 | [Environnements](../architecture/specifications/modules/clariprint-data/capabilities/production-environments.md) |
| DEC-028 | Associations BU-fournisseur avec priorité et valeur par défaut | Ouverte | À nommer | J0 | [Analyse PRD initial](./13-analyse-prd-initial-printflow.md) |
| DEC-029 | Un pool Clariprint Data déclare exclusivement des coûts de production | Acceptée | Product Owner | J0 | Découle de [DEC-025](#décisions-métier-et-produit) |
| DEC-030 | Une politique profil peut être globale ou spécifique par machine et possède une période de validité | Remplacée | Product Owner | J0 | Hors périmètre Clariprint Data selon [DEC-025](#décisions-métier-et-produit) |
| DEC-031 | Un contrat d'accès accepte plusieurs clés locales ou peut être publié pour un mode d'accès externe | Acceptée | Product Owner | J7 | [Contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md) |
| DEC-032 | Formules exactes de marge sur coût, majoration et remise | Remplacée | Product Owner | J0 | Hors périmètre Clariprint Data selon [DEC-025](#décisions-métier-et-produit) |
| DEC-033 | Remplacement ou cumul entre politique globale et exception machine | Remplacée | Product Owner | J0 | Hors périmètre Clariprint Data selon [DEC-025](#décisions-métier-et-produit) |
| DEC-034 | Protocole de résolution externe des contrats publiés | Ouverte | À nommer | J7 | [Contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md) |

## Décisions d'architecture

| ID | Décision | Statut | Responsable | Jalon requis | Réponse / ADR |
|---|---|---|---|---|---|
| ARCH-001 | Clariprint Data est un module du monolithe modulaire | Proposée | À nommer | J1 | — |
| ARCH-002 | Le kernel ne dépend ni de Supabase ni du legacy | Proposée | À nommer | J1 | — |
| ARCH-003 | Chaque module possède ses ports et repositories | Proposée | À nommer | J1 | — |
| ARCH-004 | Schéma PostgreSQL dédié ou préfixe de tables | Ouverte | À nommer | J1 | — |
| ARCH-005 | Publications stockées comme snapshot complet immuable | Proposée | À nommer | J5 | — |
| ARCH-006 | Séparation physique ou logique des champs financiers | Ouverte | À nommer | J4 | — |
| ARCH-007 | Protocole de livraison au solveur | Ouverte | À nommer | J7 | — |
| ARCH-008 | Stratégie d'idempotence import/export | Ouverte | À nommer | J7 | — |
| ARCH-009 | Copie ou référence versionnée des catalogues BU dans une publication | Ouverte | À nommer | J5 | [Propriété des données](../architecture/specifications/modules/clariprint-data/data-ownership.md) |
| ARCH-010 | Stockage et évaluation des grants de délégation | Ouverte | À nommer | J1 | [Access](../architecture/specifications/platform/access/specification.md) |
| ARCH-011 | Représentation typée des barèmes et contrat de test | Ouverte | À nommer | J4 | [Barèmes](../architecture/specifications/modules/clariprint-data/capabilities/pricing-schedules.md) |
| ARCH-012 | Ownership SQL des référentiels matière et transport BU | Ouverte | À nommer | J3 | [Propriété des données](../architecture/specifications/modules/clariprint-data/data-ownership.md) |
| ARCH-013 | Le dictionnaire d'entités historique n'est pas utilisé directement comme schéma SQL | Proposée | À nommer | J1 | [Analyse PRD initial](./13-analyse-prd-initial-printflow.md) |
| ARCH-014 | Le solveur d'optimisation reste extérieur ; Clariprint Data lui transmet les données techniques et coûts de production sans ajustement commercial | Acceptée | Product Owner | J0 | [Analyse PRD initial](./13-analyse-prd-initial-printflow.md) |
| ARCH-015 | Clariprint Data génère un JSON complet, filtré et déterministe de coûts de production pour le solveur | Acceptée | Product Owner | J7 | [Contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md) |
| ARCH-016 | Credentials locaux multiples, rotatifs et révocables par contrat | Proposée | À nommer | J7 | [Contrats d'accès calcul](../architecture/specifications/modules/clariprint-data/capabilities/calculation-access-contracts.md) |
| ARCH-017 | Aucun composant Clariprint Data n'applique de politique commerciale au dataset solveur | Acceptée | Product Owner | J7 | Découle de [DEC-025](#décisions-métier-et-produit) |

## Modèle de décision

```text
ID :
Titre :
Statut :
Contexte :
Décision :
Alternatives considérées :
Conséquences :
Date :
Décideurs :
Lien ADR ou preuve :
```
