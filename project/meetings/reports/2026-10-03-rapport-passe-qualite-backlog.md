---
id: REPORT-2026-10-03-PASSE-QUALITE
title: Rapport de la passe de qualité du backlog migré
date: 2026-10-03
status: draft
source: REPORT-2026-10-03-MIGRATION-NOTION
---

# Rapport de la passe de qualité du backlog migré

Destinataire : Xavier Péchoultres, pour relecture de la demande de fusion, et Arnaud Mazon pour les arbitrages. Rédigé dans la nuit du 3 au 4 octobre 2026, immédiatement après la migration.

## 1. Objet

La migration a transféré le backlog Notion sans le réécrire : c'était sa règle. Le résultat portait donc l'héritage de l'import — paragraphe de provenance répété 205 fois, blocs de tâches techniques de mai 2026, listes de `data-testid`, chemins de fichiers disparus, et surtout des mentions de Supabase, de fonctions Edge et de politiques RLS **présentées comme la solution technique**, alors que Supabase a été entièrement retiré de l'architecture le 2 octobre 2026.

Cette passe réécrit les 205 stories pour un lecteur précis : **un agent de développement qui doit produire du code juste**. Elle ne décide rien.

## 2. Méthode

Quinze lots, découpés par epic et par cohérence métier, traités en parallèle par des agents distincts. Un lot pilote (`EPIC-E2`, 5 stories) a été relu et validé avant d'engager les quatorze autres.

Chaque agent avait la même consigne et les mêmes interdits :

- ne jamais toucher au frontmatter, sauf `dependencies:` et seulement sur citation explicite d'un identifiant existant ;
- ne jamais passer une story `approved` ;
- **ne jamais inventer une exigence absente** — une source muette se déclare muette et la question part en « Questions ouvertes » ;
- reprendre **mot pour mot** la section « Preuves relevées dans le dépôt », qui est un constat factuel ;
- vérifier dans `src/`, `tests/` et `openapi/magrit-core.v1.yaml` avant d'affirmer qu'un composant, une route ou un fichier existe ;
- signaler les écarts entre la story et le code, jamais les lisser.

## 3. Structure cible

| Section | Rôle |
|---|---|
| Phrase d'accroche | ce que la story permet, et pour qui |
| Valeur métier | ce que cela fait gagner ou évite de perdre, concrètement |
| Défaut constaté | pour les correctifs seulement : ce qui ne marchait pas et ce que cela coûtait |
| Besoin utilisateur | en tant que… je veux… afin de… |
| Comportement attendu | le parcours nominal, du point de vue de l'utilisateur |
| Expérience utilisateur | états vides, chargement, erreurs, messages, accessibilité, réversibilité |
| Règles métier | invariants numérotés `RM-01`… |
| Critères d'acceptation | numérotés `AC-01`…, chacun observable : situation, action, résultat constatable |
| Cas limites | ce qui se passe quand ça se passe mal, ou aux bornes |
| Hors périmètre | ce que la story ne couvre pas, pour qu'un agent ne déborde pas |
| Dépendances et décisions | prérequis, décisions applicables, questions bloquantes |
| Vérification | les cahiers de tests Notion, inchangés |
| Preuves relevées dans le dépôt | constat de migration, inchangé |
| Questions ouvertes | ce qui reste à arbitrer, formulé comme une question |

## 4. Ce qui a été retiré

| Élément | Motif |
|---|---|
| Paragraphe « Provenance » | la provenance vit dans le frontmatter `source:`, la répéter en prose était du bruit |
| Blocs « Tâches / Sous-tâches » | plans de travail de mai 2026, périmés, et qui contraignaient l'implémentation au lieu de la spécifier |
| Listes de `data-testid` | le registre `src/shared/presentation/testIds.ts` fait foi |
| Chemins de l'ancienne arborescence | `src/pages/…`, `src/services/…`, `src/components/…` n'existent plus |
| Supabase, fonctions Edge, politiques RLS comme solution | retirés de l'architecture le 02/10/2026 (décisions C1, C2, C5) |

**Ce qui n'a pas été retiré** : les invariants métier qui se cachaient dans ces blocs. Montants en `numeric(12,2)` et taux en `numeric(6,4)`, jamais de flottant sur un prix, arrondi au centime à la dernière étape, journal d'audit en ajout seul, idempotence sur création, concurrence optimiste sur modification, isolation stricte par espace, valeurs commerciales figées à la conversion, interdiction qu'un contrôle métier vive seulement dans le navigateur. Tous conservés, reformulés en règles de comportement plutôt qu'en recettes d'implémentation.

## 5. Correction d'un défaut de la migration

La passe a mis au jour une erreur de la migration elle-même, corrigée depuis : **une mention d'identifiant en commentaire était comptée comme preuve d'implémentation**, y compris quand elle disait l'inverse. Douze statuts de livraison ont été corrigés. La méthode révisée est décrite en section 5 du rapport de migration.

Le cas le plus net : `E10.8`, gelée par arbitrage, portait `implemented` sur la foi de douze mentions dont dix écrivent « E10.8 gelée, aucun calcul de prix ici ».

## 6. Écarts entre la story et le code

C'est le principal apport de la passe. Les agents ont vérifié dans le dépôt, et ce qu'ils ont trouvé ne recoupe pas toujours ce que disent les stories. Les écarts sont écrits dans les stories concernées ; voici les plus coûteux.

### 6.1 — Sécurité et facturation

| Constat | Story | Portée |
|---|---|---|
| **Un administrateur d'espace peut changer le palier d'offre de son propre espace, sans paiement.** `magrit.update_tenant_settings` réserve l'identifiant d'URL au super-administrateur, mais pas le champ `plan`. Tant que ce n'est pas fermé, aucun plafond par offre n'est opposable : il suffit de changer d'offre. | `E7.5`, `E7.WM1`, `E9.8` | bloquante |
| **`TF-16` est au statut KO** : un utilisateur non administrateur atteindrait l'écran Utilisateurs ou l'opération d'invitation. Défaut d'étanchéité, pas d'ergonomie. | `E9.2`, `E9.3` | à vérifier d'urgence |
| **La règle d'ajout au panier du 16/09/2026 n'est tenue qu'à moitié.** Des deux motifs de refus, un seul est réellement produit ; celui qui vérifie que la configuration est chiffrable est déclaré, son libellé écrit, jamais émis. Et le dispositif est une affordance d'interface, pas une garantie serveur. | `Q14-a` | bloquante |
| **Le plafond de contexte du modèle est appliqué dans le navigateur**, donc contournable. | `E2.4` | à arbitrer |

### 6.2 — Promesses non tenues par le code

| Constat | Story |
|---|---|
| `E3.2` s'intitule « Infrastructure WebSocket » : **le dépôt n'en contient aucun**. Le transport est un flux SSE sur POST, sans reconnexion, sans repli, sans mesure. | `E3.2` |
| `E3.1` promet un affichage progressif : le serveur **attend la génération complète** et émet un seul fragment ; l'interface n'a qu'un état de chargement global, donc descriptif et prix ne sont pas indépendants. | `E3.1` |
| `E10.19` — le bon de commande **ne se regénère jamais** (409 au second essai) et vit **hors du magasin de fichiers** : un client ne peut pas récupérer sa pièce. | `E10.19` |
| `E10.18` — la source promettait un basculement en tâche de fond au-delà de 5 000 lignes ; le code **refuse** l'export au-delà de 2 500. Un an de commandes peut être inexportable. | `E10.18` |
| `E10.11` — `can_discount` et le seuil de remise **n'existent nulle part**. Tout membre pouvant éditer un devis peut remiser sans limite. Et `can_manage_pricing` n'est pas délégable : la règle « admin unique » du 14/08 le refuse. | `E10.11`, `E10.9` |
| `E10.3` — la décision `PD-2026-10-01-B5` rétablit la création directe d'un devis sans projet, mais le contrat **impose** `project_id` et au moins un élément de projet. | `E10.3` |
| `E1.fix-TF51` — le correctif du badge « Prix marché » vise `PricingPanel.tsx`, qui n'est **ni importé ni exporté** : c'est du code mort. L'écran réellement rendu n'a aucun badge. Quatre formulations du libellé coexistent par ailleurs. | `E1.fix-TF51` |
| `E6.1` / `E10.4` — la vérification INSEE est **dupliquée et simulée des deux côtés**. `E10.4` affirme réutiliser le service de `E6.1` ; le code le réimplémente. Un seul branchement réel laissera l'autre simulation en place, silencieusement. | `E6.1`, `E10.4` |
| `E1.WM2` et `E1.WM3` posent « zéro appel direct à Clariprint », ce qui **contredit** la règle opposable du dépôt imposant le port `ClariprintAdapter`, lequel organise l'appel direct. | `E1.WM2`, `E1.WM3` |

### 6.3 — Le contrat d'API est une API de lecture

Sur l'ensemble de `openapi/magrit-core.v1.yaml`, **une seule** opération exige une portée d'écriture pour une clé de service. Créer un devis, le convertir en commande, importer une carte : tout est fermé à un tiers. La livraison d'événements vers un abonné externe n'est ouverte par aucun endpoint. Aucune émission ni gestion de clé de service n'existe en production.

Conséquence directe : **`US-CONV-02`, la story P0 attendue par Expert Solutions, décrit le sens Magrit → Studio alors que le contrat publie l'inverse.** Et le vocabulaire de Studio (`card.DBK`, `clicked_intent`) est gravé dans la v1 : le remplacer par une commande neutre est encore possible aujourd'hui, plus après le premier intégrateur.

### 6.4 — Deux chantiers font autorité sans décision écrite

| Chantier | Où il fait autorité | Stories dépendantes |
|---|---|---|
| **UM — gestion des utilisateurs (août 2026)** : trois types de compte, deux options produit, règle « admin unique », en remplacement de `magrit_full`/`shop_only` et des quatre droits `can_*` | `docs/SHOP_ACCESS_CONTROL.md`, commentaires de `docs/api/CONVENTIONS.md` | `E9.1`, `E9.2`, `E9.3`, `E9.9`, `E9.10`, `E9.13`, `E10.11` |
| **Forme de l'URL de boutique (19/09/2026)** | `docs/api/CONVENTIONS.md` | `E4.WM2` |

Aucun des deux ne porte de fichier dans `project/decisions/`. C'est le trou de gouvernance le plus structurant relevé par la passe : un agent qui lit `E9.3` implémenterait un modèle de droits abandonné.

## 7. Entrées qui ne sont pas des stories

Quatre entrées encombrent le reste à faire sans décrire un comportement produit.

| Entrée | Nature réelle | Proposition |
|---|---|---|
| `Q-ARBITRAGES` | liste de cinq décisions en attente | convertir en entrées de `project/decisions/open-questions.md` avec responsable et échéance, puis retirer du backlog. Trois des cinq se ferment par un mot, sans une ligne de code |
| `E_PIM.audit-classification-ERAM` | tâche d'audit de données sur un client, à une date | sortir du backlog. Sa prémisse est probablement caduque : `ADR-2026-10-01-C5` acte que les données historiques ne sont pas reprises. Seule la part générique — ajouter la gamme kakémono au référentiel — mérite une exigence |
| `E6.4` | entrée de traçabilité sans développement propre, sa propre source le dit | statuer : exigence ou suppression |
| `US-INT-06` | **déclarée hors Magrit par sa propre source** (« projet hors Magrit, AGE Services ») | sortir du périmètre, ou déplacer vers le backlog AGE Services |

Deux études de décision — `T03.WM2` (Shopify GO/NO-GO) et `T07.WM1` (Canva GO/NO-GO) — posent la même question. Elles ont été écrites comme des études, avec un livrable « rapport et décision » et la liste des questions que le rapport doit trancher, mais leur place dans un backlog de stories reste à arbitrer.

## 8. Doublons et recouvrements signalés

| Doublon | Stories |
|---|---|
| Comparateur multi-prix | `T06.4` ↔ `T06.WM3` |
| Monétisation publicitaire (plafond 3 ou 5) | `T06.5`, `T06.6` ↔ `T06.WM4` |
| Aller-retour Canva, deux cadrages jamais rapprochés | `T07.1`–`T07.3` ↔ `T07.WM2` |
| Pipeline d'ingestion d'appel d'offres | `US-AO-06` ↔ `T08.N1`–`T08.N14` |
| Moteur de mapping de colonnes | `T08.B2` ↔ `T08.N4` |
| Écran d'anomalies | `T08.B5` ↔ `T08.N14` |
| Module AO, deux acteurs différents | `T08.WM1` ↔ `T08.A1`+`T08.A2` |
| Workflow de validation et piste d'audit | `T08.A5` ↔ `T01.4`+`T01.6` |
| Écran de coûts du modèle | `E7.6` ↔ `E7.WM2` |
| Plafond Freemium : 10 devis / 30 jours glissants contre 5 devis / jour | `E7.5` ↔ `E7.WM1` |
| Moteur de rapports | `T01.6` ↔ `T02.6` |
| Saisie simplifiée imprimeur, même écran | `E3.4` ↔ `E6.2` |
| k-anonymat ≥ 10 contre parc restreint à « environ 10 » | `T06.2` ↔ `T06.WM1` |

## 9. Contradictions de modèle

**Un site de franchise est-il un tenant ou un sous-espace ?** La décision `PD-2026-10-01-B3` pose que le tenant est l'unité de facturation et une entité juridique distincte, et que le sous-espace est la filiale d'un groupe au sein d'un tenant. Or un réseau de franchise est fait d'entités juridiques distinctes. Si un site est un tenant, la consolidation traverse des frontières de facturation ; si c'est un sous-espace, le réseau devient un seul tenant, ce que la franchise ne permet pas. **Aucune story `T-02` n'est planifiable avant cet arbitrage**, et `T-01` en dépend par ricochet.

La question ouverte `OQ-B3-PARC` bloque huit stories des epics `T-01` et `T-02`, plus `E9.3`, `E9.4`, `E9.6`, `E9.8`, `E9.10`, `T06.1` et `T06.3`.

## 10. Matière manquante qui bloque la vérification

| Élément | Conséquence |
|---|---|
| Fixture `bpu_ici_lot1.xlsx` et `Referentiel_AO_GroupeICI_LOT1.md` non versionnés | une quinzaine de critères chiffrés de `T08.N*` ne sont pas jouables |
| Compte rendu de la réunion du 12/05/2026 absent du dépôt | `E1.WM1`, `E1.WM2`, `E1.WM3` n'ont pas de source consultable |
| Brief `SPEC_data-testid_06052026.md` introuvable | `E7.7` n'a plus la définition de son périmètre |
| Module Excel « existant » hors de ce dépôt | `US-AO-08` est sans objet tant qu'il n'est pas localisé |
| Travail PrestaShop de Laurent Rebière absent | `T03.WM1` n'est pas estimable |
| Aucune bibliothèque capable de **lire** un classeur binaire | `T08.N1` et `T08.N13` en dépendent ; le seul outil du dépôt écrit des classeurs neufs, et la source désigne une bibliothèque Python dans un dépôt TypeScript |

## 11. Hygiène du dépôt relevée au passage

- **`pnpm test` n'est exécuté par aucune chaîne d'intégration continue** sur une demande de fusion vers `main`. Seuls les tests d'architecture, de contrat et un répertoire ciblé le sont. `a11y.yml` se déclenche encore sur `beta/v5`.
- **18 `data-testid` sont écrits en clair** dans les composants sans figurer au registre, alors que `CLAUDE.md` l'interdit. Aucune configuration ESLint dans le dépôt, et le contrôle existant ne vérifie pas la réciproque.
- Le persona est **Magrit** depuis le 8 mai 2026. « Marguerite » subsiste dans le titre de `T05.3`, dans l'écran de création d'espace, et dans plusieurs libellés affichés.

## 12. Ce que cette passe n'a pas fait

- Aucun statut documentaire n'est passé `approved` : les rôles d'approbation ne sont pas attribués (`OQ-GOV-ROLES`).
- Aucune décision du 1er octobre n'a été propagée dans les stories : les stories touchées sont relevées, la propagation revient à l'agent de gestion de projet.
- Aucune story n'a été supprimée, fusionnée ni dépréciée : les doublons et les caducités sont signalés, l'arbitrage appartient à l'autorité produit.
- Aucun `specStatus` n'a été passé à `superseded`, y compris pour `T08.WM2` qui se déclare remplacée dans son propre titre.
- Aucun code applicatif n'a été modifié.

## 13. Contrôles

| Contrôle | Résultat |
|---|---|
| `pnpm project:validate` | ✅ 265 artefacts, 265 identifiants uniques |
| `pnpm specs:validate` | ✅ modèle conforme |
| `git diff --check` | ✅ propre |
| Frontmatter préservé | ✅ vérifié par empreinte par chaque agent, hors `dependencies:` |
| Section « Preuves relevées dans le dépôt » | ✅ identique mot pour mot sur les 205 |
| Aucun contenu `approved` | ✅ 201 `draft`, 4 `contradictory` |

---

*Rapport produit par des agents. Il prépare des décisions, il n'en prend aucune.*
