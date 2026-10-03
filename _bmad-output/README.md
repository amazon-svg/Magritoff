# Statut des productions BMAD

Ce dossier conserve les productions historiques générées par les workflows BMAD. Il n'est plus une source canonique autonome pour la vision, le backlog ou les décisions.

## Autorité

- La gouvernance, les PRD, le backlog, les décisions, les réunions et les sprints actifs se trouvent dans `project/`.
- Le code et les tests au commit considéré décrivent le comportement livré.
- Les contrats et règles techniques restent à leurs emplacements dédiés, notamment `openapi/` et `docs/`.
- Un fichier de ce dossier peut servir de provenance ou de preuve, mais ne remplace pas un artefact approuvé dans `project/`.

## Classement des sous-dossiers

| Dossier | Fonction | Traitement |
|---|---|---|
| `planning-artifacts/` | PRD, epics, architecture et études historiques | Extraire les éléments encore valides vers `project/`, puis conserver comme provenance |
| `implementation-artifacts/` | Story documents, états de sprint et rétrospectives | Conserver comme preuves et historiques d'implémentation ; référencer les stories canoniques |
| `refacto-artifacts/` | Rapports de refactorisation | Conserver comme historique technique ; extraire uniquement les décisions encore actives |
| `brainstorming/` | Exploration | Conserver comme contexte non opposable |

## Règles pour les nouvelles productions

1. Toute sortie BMAD nouvelle commence au statut `draft`.
2. Une décision ou exigence destinée à devenir active est propagée dans `project/`.
3. Une story d'implémentation référence sa story fonctionnelle canonique au lieu d'en recopier le contenu.
4. Aucun document BMAD ne s'auto-attribue le statut `approved`.
5. Les fichiers historiques ne sont ni renommés ni supprimés tant que leurs liens et preuves n'ont pas été rapprochés.

## État de la migration

La vision, le périmètre, les principes et l'epic E10 ont été consolidés dans `project/` le 2 octobre 2026. Le backlog Notion a été migré le 3 octobre 2026 : `project/backlog/` porte désormais 18 epics, 19 fonctionnalités et 205 stories, chacune référençant son ou ses story documents de ce dossier en `implementationRecords`.

Conséquences pour ce dossier :

- les sections `notion-functional` des story documents sont **remplacées** par la story canonique du même identifiant dans `project/backlog/stories/` ; en cas de divergence, la story canonique s'applique ;
- la ligne « Source qui fait foi : Notion » que portent certains story documents est **caduque** : elle date d'avant l'atelier du 1er octobre 2026 et n'est pas corrigée fichier par fichier pour ne pas réécrire des preuves de travail datées ;
- `implementation-artifacts/INDEX-stories-notion.md` est un registre figé, remplacé par l'annexe B du rapport de migration ;
- les epics historiques recensés dans `project/backlog/epics/README.md` restent à requalifier.
