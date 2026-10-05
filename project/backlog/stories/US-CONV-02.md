---
id: US-CONV-02
title: API copilote Studio (brief → product card → prix)
epic: EPIC-E5
feature: FEAT-E5-UNCLASSIFIED
specStatus: draft
deliveryStatus: not-started
owner: unassigned
source:
  system: notion
  pageId: 375d0131973c8118b58acb780b9bf04b
  url: https://app.notion.com/375d0131973c8118b58acb780b9bf04b
  originalStatus: "Pas commencé"
  originalSprint: "Backlog"
  originalPriority: "P0"
  originalEffort: ""
  originalAssignee: "Laurent"
  originalOffering: "Technique"
  originalOrder: ""
  originalSources: "WM 03/06/2026"
  createdAt: "2026-06-04 13:30:45Z"
  lastEditedAt: "2026-06-04T13:30:00.000Z"
  importedAt: 2026-10-03
  archive: _archives-notion/2026-10-03/pages/US-CONV-02.md
decisions: []
dependencies: []
supersedes: []
implementationRecords:
  - _bmad-output/implementation-artifacts/story-US-CONV-02.md
---


# US-CONV-02 — API copilote Studio (brief → product card → prix)

> Besoin d’origine : « API dédiée au copilote Magrit Studio traitant la requête métier : brief marketing → product card → prix. »

## Relecture technique — 5 octobre 2026

Xavier précise que Studio désigne **Clariprint Studio, alias HopeStudio**, dont l’intégration est déjà avancée. Il confirme que l’orchestration des appels revient à la bibliothèque JavaScript HopeStudio. Magrit héberge cette bibliothèque, relaie ses demandes et importe les cartes reçues dans les projets.

La migration de cette story avait ajouté une interprétation en nouvelle API Magrit destinée à un CMS, un ERP ou un appelant tiers, ainsi qu’une interdiction des sessions techniques. Ces exigences ne figurent pas dans la source et sont retirées. La question « qui expose l’API ? » et les droits des clés de service ne sont plus des prérequis de cette recette. Aucun nouveau contrat ni droit utilisateur n’est décidé ici.

## Valeur métier

Vérifier que le parcours existant peut transformer un brief métier en carte produit tarifée, puis transmettre cette carte à Magrit. Le statut P0 vient de la source ; le statut de livraison importé ne signifie pas que l’intégration HopeStudio est absente.

## Besoin utilisateur

**En tant qu’utilisateur de Magrit**, **je veux** obtenir une carte produit tarifée à partir d’un brief traité par Clariprint Studio, **afin de** l’utiliser dans mon projet sans ressaisir sa configuration et son prix.

_Cette reformulation tient compte du cadrage de Xavier. Le périmètre exact « hors couche conversationnelle » reste à préciser avec le produit ; il ne permet pas de conclure que le runtime doit fonctionner sans session technique._

## Comportement attendu

1. Le brief est transmis au runtime JavaScript HopeStudio intégré à Magrit.
2. La bibliothèque choisit les actions à appeler et gère ses sessions. Magrit ne reconstitue pas cette orchestration.
3. Le transport Magrit relaie les demandes du runtime vers le serveur HopeStudio configuré pour le tenant, avec les contrôles d’accès existants.
4. HopeStudio fournit les cartes et leurs prix. L’utilisateur sélectionne une proposition dans son interface.
5. Les callbacks existants permettent d’importer la carte sélectionnée, le prix du processus choisi et les fichiers associés dans le projet Magrit.

## Expérience utilisateur

La recette part du widget HopeStudio et observe la carte tarifée puis son ajout au projet. Elle doit distinguer un problème de montage du runtime, de transport, de réponse fournisseur ou d’import. Le brief insuffisant, plusieurs propositions et la nature du prix restent des points à préciser ; aucun comportement supplémentaire n’est imposé au fournisseur par cette story.

## Règles métier

- `RM-01` — La bibliothèque JavaScript HopeStudio orchestre le traitement du brief et les actions fournisseur.
- `RM-02` — Magrit relaie le corps produit par la bibliothèque sans inventer d’action ou d’appel supplémentaire.
- `RM-03` — L’import conserve la configuration et le prix de la proposition sélectionnée.
- `RM-04` — L’accès au relais et au projet respecte les contrôles existants du tenant et de l’utilisateur.
- `RM-05` — Une carte simulée prouve le fonctionnement local de l’intégration ; elle ne prouve pas un chiffrage réel du fournisseur.

## Critères d'acceptation

**Critère de la source :** « Un brief produit renvoie une carte tarifée via l’API, hors couche conversationnelle. »

Les critères de recette ci-dessous précisent les responsabilités existantes ; ils restent à relire avant approbation de la story :

- `AC-01` — Un brief soumis par la bibliothèque HopeStudio produit une carte tarifée dans le parcours intégré.
- `AC-02` — Le relais transmet les demandes de la bibliothèque sans ajouter une création de session ou une autre action.
- `AC-03` — Le callback d’ajout importe la carte sélectionnée et le prix du processus choisi dans le projet.
- `AC-04` — Un utilisateur hors du tenant ne peut pas utiliser son relais ; une identité incompatible avec le tenant est refusée.
- `AC-05` — La recette indique explicitement si les réponses sont simulées ou obtenues du fournisseur réel.

## Cas limites

- **Sessions techniques.** Le runtime existant utilise des sessions par projet. « Hors couche conversationnelle » ne supprime pas ce mécanisme ; le sens fonctionnel de cette expression reste à confirmer.
- **Prix importé.** Il provient de la carte transmise par le navigateur. Sa valeur opposable et une éventuelle validation serveur relèvent du cadrage des prix, pas d’une nouvelle orchestration du brief par Magrit.
- **Chemin serveur distinct.** Le dépôt contient aussi un adaptateur d’assistant qui construit directement des actions HopeStudio. Ce chemin ne constitue pas la recette du widget JavaScript décrite ici ; son maintien et ses usages doivent être examinés séparément avant toute modification.
- **Contrat.** L’import `POST /projects/{projectId}/hopstudio-items` est au contrat v1. La conformité documentaire du relais existant reste un sujet d’architecture distinct ; elle ne justifie pas la création d’une nouvelle API de génération.
- **Plusieurs propositions ou brief incomplet.** Le comportement fourni par HopeStudio doit être observé et rapproché du besoin produit avant d’ajouter une exigence locale.

## Hors périmètre

- Une API généraliste pour CMS, ERP ou intégrateurs tiers, et ses clés de service.
- Une orchestration Magrit directe des actions de génération HopeStudio.
- Une nouvelle politique de chiffrage, de facturation fournisseur ou de droits utilisateurs.
- La suppression du chemin d’assistant serveur sans audit de ses usages.

## Dépendances et décisions

- Cadrage explicite de Xavier dans cette conversation, le 5 octobre 2026 : Clariprint Studio / HopeStudio orchestre au travers de sa bibliothèque JavaScript.
- `ADR-2026-10-01-C4` : contrat API unique pour les surfaces Magrit ; vérifier les surfaces existantes dans un travail d’architecture dédié.
- `ADR-2026-10-01-C1` : stack serveur portable, ancien handoff Supabase historique.
- `E1.WM2` : POC d’intégration Studio par interface copilote, à rapprocher de cette story.
- Origine : séance de travail du 03/06/2026. La source historique est conservée dans `_bmad-output/implementation-artifacts/story-US-CONV-02.md`.

## Vérification

Les tests locaux pertinents portent sur le transport exact, les contrôles du handler, le client API, la sélection du prix et les callbacks de fichiers. La page `/dev/hopstudio` monte le vrai bundle avec des réponses métier simulées ; elle ne valide pas un calcul fournisseur réel.

Le test `pnpm test:hopstudio:live` appelle directement un adaptateur serveur. Il n’est pas la recette retenue pour cette story et n’est pas lancé. La preuve complète brief → carte tarifée → ajout au projet doit provenir du parcours de la bibliothèque JavaScript.

### Recette locale du parcours intégré — 5 octobre 2026

`tests/e2e/hopstudio-project-import.spec.ts` utilise le bundle fournisseur réel et le configurateur de production, avec réponses fournisseur et écritures projet simulées dans le navigateur. Les accès externes sont bloqués ; aucun secret fournisseur n’est nécessaire.

Le test vérifie : sélection d’un projet, envoi d’un brief, création de session par la bibliothèque, réception d’une carte, tri des offres, sélection de la seconde offre à 125,50 €, import de sa configuration avec clé d’idempotence, confirmation et affichage de la ligne dans les éléments du projet. Les actions du runtime comprennent `newSession`, `CallAI`, `loadSessionParts` et `GetSVG_List`. La création de session par HopeStudio est attendue ; ce que Magrit ne doit pas faire est en ajouter une de sa propre initiative.

Cette recette est ajoutée au job navigateur portable de la CI. Les PDF et SVG ne sont pas couverts par cette fixture (aucun fichier associé) ; leurs callbacks restent couverts par les tests unitaires. La persistance réelle et le chiffrage fournisseur ne sont pas démontrés par le test navigateur simulé. Le critère historique « hors couche conversationnelle » reste à relire avant de déclarer cette story vérifiée.

## Preuves relevées dans le dépôt

- `src/modules/hopstudio/ui/HopeStudioWorkspace.tsx` : montage du runtime, `customApiFetch`, sessions et callbacks d’import.
- `src/modules/hopstudio/api/client.ts` : client du relais Magrit.
- `src/server/hopstudio/workflow-handler.ts` : contrôle d’accès et transmission au gateway.
- `src/adapters/hopstudio/http-hopstudio-workflow-gateway.ts` : relais vers le serveur fournisseur configuré.
- `openapi/magrit-core.v1.yaml` : import de carte dans le projet.
- Lots historiques `HSPQ-1` et `HSPQ-2` : sessions par projet, import de cartes et fichiers fournisseur.

`deliveryStatus: not-started` est conservé tant que le critère précis de cette story n’a pas été vérifié. Il ne remplace pas l’état des lots déjà livrés.

## Questions ouvertes

- Que signifie exactement « hors couche conversationnelle » dans le besoin d’origine, compte tenu du runtime et de ses sessions existantes ?
- Quelle partie du critère d’origine manque encore dans le parcours JavaScript déjà intégré ? Une recette de ce parcours doit le déterminer.
- Quelle valeur métier donner au prix importé : estimation ou prix engageant, et quelle validation est requise ?
- Rattachement à une fonctionnalité produit à relire (`FEAT-E5-UNCLASSIFIED` est un regroupement de migration).
- Relecture produit requise : cette story reste `draft` et n’est pas déclarée prête à implémenter.

## Circuit de validation HopeStudio

Xavier Péchoultres est le référent et approbateur produit et technique du périmètre HopeStudio, selon sa précision du 5 octobre 2026 consignée dans [les rôles](../../governance/roles.md). Les questions relatives au runtime, à ses contrats et au résultat attendu lui sont adressées. Les engagements communs à l’intégration Magrit restent à examiner avec l’équipe concernée ; la revue de code reste distincte. Cette attribution ne constitue pas une approbation de la présente story.
