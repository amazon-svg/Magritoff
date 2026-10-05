# Matrice de correspondance entre l'existant et la gouvernance cible

## Principe de classement

Chaque artefact existant est classé selon l'une des quatre fonctions suivantes :

- **canonique** : décrit une règle actuellement applicable dans un périmètre identifié ;
- **dérivé** : vue, index ou génération reconstruite depuis des sources canoniques ;
- **historique** : conserve une preuve, une livraison ou une décision passée ;
- **transitoire** : nécessaire pendant la sortie de Notion ou la consolidation, mais destiné à être remplacé.

Aucun fichier n'est déplacé ou supprimé par cet audit.

## Matrice principale

| Artefact actuel | Situation constatée | Fonction actuelle | Cible recommandée | Traitement | Priorité |
|---|---|---|---|---|---|
| `quality/specs/spec.schema.json` | Schéma complet, validateur existant | Outillage canonique potentiel | Conserver et faire évoluer après pilote | Ajouter relations, approbation, remplacement et séparation des statuts si le pilote le confirme | Haute |
| `quality/specs/_template.spec.yaml` | Modèle cohérent, aucune instance métier | Modèle | Conserver | Produire une première instance avec E10.15, puis corriger le modèle | Haute |
| `quality/specs/README.md` | Décrit déjà la hiérarchie, les statuts et les tests | Gouvernance locale | Rapprocher de la gouvernance générale | Retirer progressivement les règles spécifiques à Notion après import | Haute |
| `docs/spec/STORY_DOCUMENT_STANDARD.md` | Règle permanente déclarant Notion comme autorité | Canonique actif | Réviser après réussite du pilote | Remplacer la synchronisation Notion par une référence à la spécification Git | Haute |
| `docs/spec/notion-extraction-format.md` | Contrat d'import Notion | Transitoire | Archive de migration | Conserver jusqu'à l'export final, puis figer | Moyenne |
| `docs/spec/backlog.md` | Vue structurée de 306 stories et du Sprint 5 | Dérivé | Vue générée du backlog Git | Ne pas saisir manuellement ; régénérer depuis les métadonnées normalisées | Haute |
| `INDEX-stories-notion.md` | Index généré de 197 stories Notion | Transitoire et dérivé | Registre de migration puis archive | Utiliser pour contrôler l'import ; remplacer ensuite par un index Git | Haute |
| `story-*.md` | 541 documents, formats et statuts hétérogènes | Fonctionnel copié + historique d'implémentation | À séparer logiquement | Ne pas déplacer en masse ; classer pendant les pilotes et migrations de domaine | Haute |
| Sections `notion-functional` | 533 documents, dont copies Notion et déclarations sans rattachement | Transitoire | Spécification Git ou référence vers celle-ci | Importer le contenu utile, approuver, puis supprimer la dépendance au marqueur | Haute |
| Frontmatter des stories | 39 fichiers sans frontmatter, 54 variantes de statut | Métadonnées partielles | Métadonnées normalisées | Définir un schéma minimal et une conversion automatisée | Haute |
| `TF-NOTION-*.md` | 12 cas de test séparés | Spécification de recette historique | Cas de test liés aux critères | Conserver, normaliser les identifiants et relier aux specs | Moyenne |
| Références aux tests dans les stories | Présentes dans 177 stories, qualité variable | Preuve partielle | Matrice critère vers preuve | Distinguer preuve directe, garde transverse et échec hors périmètre | Haute |
| `_bmad-output/planning-artifacts/prd.md` | PRD principal ancien, enrichi jusqu'en juillet | Source produit historique | PRD consolidé | Comparer aux décisions plus récentes et réviser, sans déplacement immédiat | Haute |
| `prd-entites-juridiques-facturation-boutiques.md` | PRD spécialisé | Source de domaine | PRD ou spécification de domaine | Fusionner ou référencer depuis le PRD consolidé | Moyenne |
| `_bmad-output/planning-artifacts/epics.md` | Epics, stories, sprints et validations mêlés | Source historique et catalogue | Epics canoniques + vues dérivées | Extraire les epics actives ; ne pas recopier les stories déjà documentées | Haute |
| Spécifications de domaine dans `planning-artifacts` | Plusieurs documents UX, identités et migration | Sources spécialisées | PRD de domaine, décision ou archive | Classer individuellement pendant la migration du domaine concerné | Moyenne |
| `_bmad-output` généré par BMAD | Mélange de sorties préparatoires et artefacts devenus opposables | Source ambiguë | Zone de génération et d'historique | Ne changer son rôle qu'après déplacement ou référencement des règles actives | Haute |
| `docs/REGLES_ARCHITECTURE.md` | R1 à R8, explicitement opposables | Canonique technique | Conserver | Le document de gouvernance doit déclarer qu'il le complète sans le remplacer | Haute |
| `openapi/magrit-core.v1.yaml` | Contrat API E10 de référence | Canonique technique | Conserver à son emplacement | Aucun déplacement ; continuer les contrôles contractuels | Haute |
| `docs/architecture/api/openapi.yaml` | Ancien contrat déclaré déprécié | Historique | Archive dépréciée | Ajouter une indication machine lisible si nécessaire, ne plus étendre | Moyenne |
| `docs/api/CONVENTIONS.md` | Plus de 1,3 Mo, opposable, mélange règles et décisions | Canonique technique surchargé | Politiques API + ADR + liens vers specs | Décomposer progressivement par pilote, sans big-bang | Haute |
| `_bmad-output/planning-artifacts/architecture.md` | Architecture BMAD plus récente que le document racine | Source technique historique ou partiellement active | Baseline d'architecture consolidée | Comparer aux règles et au code actuel avant approbation | Moyenne |
| `ARCHITECTURE.md` | Documentation technique initiale, dernière évolution ancienne | Historique | Archive ou introduction d'architecture | Vérifier les parties encore vraies, ne pas traiter comme autorité globale | Moyenne |
| `CLAUDE.md` | Point d'entrée des agents, recopie plusieurs règles | Canonique opérationnel de fait | Index des règles canoniques | Réduire les duplications ; garder les liens et instructions indispensables | Haute |
| `SPRINT_HANDOFF.md` | Plus de 200 Ko, journal de reprise très riche | Historique et état courant mêlés | Archive + état de sprint + décisions + actions | Cesser l'accumulation après mise en place d'un remplacement, extraire au fil de l'eau | Haute |
| Fichiers `sprint-status-*` | Deux instantanés anciens | Historique | Historique de sprint | Conserver ou archiver par sprint | Basse |
| Rétrospectives | Cinq documents | Historique de sprint | Historique de sprint | Conserver avec liens vers les actions issues de la rétrospective | Basse |
| `docs/project-context.md` | Contexte destiné aux agents | Contexte dérivé ou partiellement canonique | Vue synthétique régénérable | Vérifier les duplications avec `CLAUDE.md` et l'architecture | Moyenne |
| Rapports de refactorisation | Quatre documents datés | Historique technique | Archive technique | Extraire uniquement les décisions encore actives | Basse |

## Correspondance avec l'arborescence envisagée

La proposition `project/` peut être représentée sans créer immédiatement de nouveaux dossiers :

| Fonction cible | Emplacements actuels susceptibles de la porter | Décision provisoire |
|---|---|---|
| Gouvernance | `docs/GOUVERNANCE_*`, `docs/spec`, `docs/REGLES_ARCHITECTURE.md`, `CLAUDE.md` | Normaliser les liens avant tout déplacement |
| PRD | `_bmad-output/planning-artifacts/prd*.md`, spécifications de domaine | Consolider un domaine pilote |
| Epics | `epics.md`, `docs/spec/backlog.md`, story frontmatter | Produire une vue depuis les métadonnées |
| Fonctionnalités | PRD, epics, stories et documents de domaine | Le niveau « feature » doit être testé pendant le pilote avant généralisation |
| Stories | `_bmad-output/implementation-artifacts/story-*.md` | Ne pas déplacer ; séparer spécification et livraison |
| Décisions | `docs/api/CONVENTIONS.md`, PRD, stories, handoff, CR futurs | Créer un registre seulement à partir de décisions réellement extraites |
| Comptes rendus | Aucun dépôt canonique identifié | Introduire un modèle après validation de la gouvernance minimale |
| Sprints | `sprint-status-*`, `SPRINT_HANDOFF.md`, frontmatter de stories | Définir une vue légère basée sur les IDs |
| Tests | `tests/`, cas TF et références dans les stories | Laisser les tests en place et améliorer la traçabilité |

Cette correspondance favorise une normalisation in situ. La création de `project/` ne devient utile que si le pilote montre que les emplacements actuels empêchent les validations ou la découverte par les agents.

## Hiérarchie recommandée pendant la transition

Tant que la migration n'est pas terminée, la hiérarchie suivante évite les changements implicites :

1. code et tests pour constater le comportement livré à un commit donné ;
2. `openapi/magrit-core.v1.yaml` pour le contrat API E10 ;
3. règles explicitement opposables existantes dans `REGLES_ARCHITECTURE.md` et `docs/api/CONVENTIONS.md` ;
4. périmètre fonctionnel Notion copié dans les story documents, jusqu'à import et approbation Git ;
5. PRD, epics et documents de domaine pour l'intention non contredite par une décision plus récente ;
6. rapports, handoff et conversations comme sources de contexte et de décisions à extraire.

Cette hiérarchie est transitoire. Elle ne doit pas être interprétée comme une reconduction durable de Notion.

## Changements minimaux avant migration

Les changements suivants peuvent être préparés sans déplacer le corpus :

1. ajouter un champ de relation stable entre une story parente et ses lots ;
2. définir quatre à six valeurs courtes pour le statut de livraison ;
3. définir les rôles d'approbation produit et technique ;
4. compléter le schéma de `quality/specs` uniquement à partir des besoins observés dans le pilote ;
5. produire une spécification Git E10.15 et sa matrice de tests ;
6. vérifier que les vues existantes peuvent être générées depuis ces métadonnées ;
7. décider ensuite si un déplacement physique apporte une valeur réelle.

## Éléments à ne pas faire avant le pilote

- déplacer les 541 story documents ;
- renommer tous les identifiants historiques ;
- supprimer les sections Notion avant import vérifié ;
- déprécier `REGLES_ARCHITECTURE.md` ou le contrat OpenAPI ;
- convertir automatiquement tous les statuts libres sans table de correspondance validée ;
- recopier les décisions de `docs/api/CONVENTIONS.md` dans un nouveau dossier sans liens ni stratégie de remplacement ;
- déclarer le corpus reproductible uniquement parce que tous les fichiers ont une destination.
