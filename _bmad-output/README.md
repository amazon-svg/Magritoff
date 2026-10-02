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

## Migration en cours

La vision, le périmètre, les principes et l'epic E10 ont été consolidés dans `project/`. Les autres epics historiques sont recensés dans `project/backlog/epics/README.md` et seront traités seulement après vérification de leur état réel.
