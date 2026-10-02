# Gestion de projet Magrit

Ce dossier est la source Git canonique pour la vision produit, le backlog, les décisions, les comptes rendus et les sprints de Magrit.

La décision a été prise lors de l'atelier du 1er octobre 2026. Notion est désormais une source historique en cours de migration, sans nouvelle saisie. Les éléments importés restent au statut `draft` jusqu'à approbation humaine.

## Organisation

| Dossier | Contenu |
|---|---|
| [`governance/`](governance/) | Sources de vérité, workflow, rôles et critères de qualité |
| [`prd/`](prd/) | Vision, périmètre, principes et domaines fonctionnels |
| [`backlog/`](backlog/) | Epics, fonctionnalités et stories |
| [`meetings/`](meetings/) | Comptes rendus et rapports de réorganisation |
| [`decisions/`](decisions/) | Décisions produit, décisions techniques et questions ouvertes |
| [`sprints/`](sprints/) | Sélections temporelles de stories, revues et rétrospectives |

## Règles essentielles

1. Git fait foi pour les documents approuvés.
2. Une information possède un emplacement canonique unique ; les autres fichiers la référencent par identifiant.
3. Le code et les tests au commit considéré décrivent le comportement livré ; ils ne remplacent pas l'intention produit.
4. Toute production d'agent reste `draft` jusqu'à approbation humaine.
5. Une décision de réunion doit être propagée dans les artefacts concernés avant d'être considérée comme appliquée.
6. Une nouvelle story vérifie les stories et tests antérieurs qu'elle modifie ou invalide.

## Transition depuis l'ancien corpus

Les documents dans `_bmad-output`, `docs/spec`, `quality/specs` et `SPRINT_HANDOFF.md` ne sont pas déplacés automatiquement. Ils restent des sources historiques ou techniques pendant la migration.

L'inventaire et la stratégie de correspondance sont disponibles dans [`docs/governance-audit/`](../docs/governance-audit/). La migration Notion doit créer les éléments du backlog ici, avec leur provenance, sans supprimer les originaux avant validation.

## Validation

Exécuter :

```bash
pnpm project:validate
pnpm specs:validate
```

Le premier contrôle vérifie la structure et les métadonnées de ce dossier. Le second vérifie les spécifications fonctionnelles auditables de `quality/specs`.
