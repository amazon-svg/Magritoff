# PrintFlow Pro — Product Requirements Document

> **Document de référence — Version 1.0**
> Logiciel tout-en-un pour gérer et optimiser les environnements d'imprimerie :
> machines, catalogues de matières, prix, configurations, et modèle de coûts de production.

---

## Sommaire

1. [Vision et Objectifs](#1-vision-et-objectifs)
2. [Personae](#2-personae)
3. [Matrice des Rôles & Permissions](#3-matrice-des-rôles--permissions)
4. [Flux Opérationnels](#4-flux-opérationnels)
5. [Modèle de Coûts (Cost Model Engine)](#5-modèle-de-coûts-cost-model-engine)
6. [Dictionnaire des Données — Annexe Exhaustive](#6-dictionnaire-des-données--annexe-exhaustive)
7. [Règles Transversales & Conventions](#7-règles-transversales--conventions)
8. [Points de Vigilance & Roadmap](#8-points-de-vigilance--roadmap)

---

## 1. Vision et Objectifs

### 1.1 Mission
PrintFlow Pro centralise la configuration technique et financière des environnements de production d'imprimerie. Il transforme des paramètres machines hétérogènes (barèmes, cadences, gâches, formats) en un **prix de revient** reproductible, auditables et partageables.

### 1.2 Problèmes résolus
- **Éparpillement** des barèmes machines dans des fichiers non structurés.
- **Opacité** du calcul de coût (gâches, frais généraux, énergie, marges).
- **Absence de versioning** des configurations en production.
- **Collaboration difficile** avec les fournisseurs de papier et transporteurs externes.

### 1.3 Principes directeurs
- **Multi-tenant strict** : isolation par `tenantId`, scoping par `buId`.
- **Référentiel machine rigide** : les barèmes sont des structures de données, pas du texte libre.
- **Audit complet** : toute modification est tracée (`AuditLog`) avec snapshot avant/après.
- **Partage sécurisé** : tokens révocables avec scopes limités pour les acteurs externes.

---

## 2. Personae

### 2.1 Tenant Admin (Administrateur d'organisation)
- **Profil** : DSI ou directeur technique d'un groupe d'imprimerie multi-sites.
- **Besoins** : Gérer plusieurs Business Units, inviter des administrateurs locaux, superviser la conformité et la cohérence des configurations.
- **Périmètre** : Tous les environnements du tenant.
- **Outils** : `TenantDashboard`, invitation de `buAdmin`, gestion des `PermissionMatrix`.

### 2.2 BU Admin (Administrateur de Business Unit)
- **Profil** : Responsable de site ou de filiale.
- **Besoins** : Créer des environnements d'impression, assigner des administrateurs spécialisés (papier, imprimeur, projet), valider la mise en production.
- **Périmètre** : Une `BU` et tous ses environnements rattachés.
- **Outils** : `BUEdit`, `BUUsers`, création de `PrinterEnvironment` et `ProjectEnvironment`.

### 2.3 Printer Admin (Administrateur Imprimeur)
- **Profil** : Conducteur de production ou chef d'atelier.
- **Besoins** : Configurer précisément les machines et leurs barèmes, gérer les gâches, valider les capacités physiques (formats, grammages).
- **Périmètre** : Un ou plusieurs `PrinterEnvironment`.
- **Outils** : `EditEnvironment` → onglet Machines, `TabMachineBaremes`, `TabMachineInfos`.

### 2.4 Paper Admin (Acheteur Papier)
- **Profil** : Acheteur ou gestionnaire de matières.
- **Besoins** : Maintenir le catalogue des fournisseurs, les marques de matières, les SKU avec leurs paliers de prix dégressifs.
- **Périmètre** : Catalogues matières de la BU.
- **Outils** : `BUPaperSuppliersTab`, `MaterialsTab`, `SkusTab`, import de tarifs.

### 2.5 Project Admin (Responsable de chiffrage / devis)
- **Profil** : Commercial technique ou responsable de projets clients.
- **Besoins** : Définir des règles de marge par projet, activer des imprimeurs et fournisseurs spécifiques, générer des chiffrages via API externe.
- **Périmètre** : Un `ProjectEnvironment`.
- **Outils** : `ProjectEnvEdit`, `ProjectEnvMarginRulesTab`, gestion des `externalApiKey`.

### 2.6 Project User (Utilisateur de chiffrage)
- **Profil** : Commercial ou opérateur de saisie.
- **Besoins** : Consulter les configurations, lancer des tests de chiffrage, voir les résultats.
- **Périmètre** : Lecture + exécution de tests.
- **Outils** : `Dashboard`, `ProjetTestModal`, `DetailCalculModal`.

### 2.7 Supplier Viewer / Editor / Tester (Acteur externe)
- **Profil** : Fournisseur de papier ou transporteur invité.
- **Besoins** : Consulter ou mettre à jour ses tarifs, répondre à des demandes de test (RSP).
- **Périmètre** : Limité par un `share_token` avec `scopes` et `role` restreints.
- **Outils** : `SharedEnvironment`, `ShareLogin`, `ShareCodeVerification`.

---

## 3. Matrice des Rôles & Permissions

### 3.1 Hiérarchie des rôles
| Rôle | Scope par défaut | Droits clés |
|------|------------------|-------------|
| `tenantAdmin` | TENANT | Tout : BU, envs, invitations, matrice |
| `buAdmin` | BU | Env, sous-admins, ressources BU |
| `buPrinterAdmin` | BU (printer) | Env d'impression de la BU |
| `buPaperAdmin` | BU (paper) | Catalogues papier de la BU |
| `buProjectAdmin` | BU (project) | ProjectEnvironment de la BU |
| `printerAdmin` | PRINTER_ENV | Une env d'impression précise |
| `paperAdmin` | PAPER_ENV | Un catalogue papier précis |
| `projectUser` | PROJECT_ENV | Lecture + tests sur un projet |

### 3.2 Rôles externes (partage)
| Rôle | Description |
|------|-------------|
| `SupplierViewer` | Lecture seule sur les données partagées |
| `SupplierEditor` | Mise à jour des tarifs/cata­logues partagés |
| `SupplierTester` | Réponse aux demandes de test (RSP) |

### 3.3 Mécanisme RBAC
- **`TenantMembership`** : rattachement principal d'un utilisateur à un tenant (rôle global + `isOwner`).
- **`RoleGrant`** : grants additionnels à portée fine (`scopeType` + `scopeId`). Permet le **cumul de rôles** (ex: un user est `printerAdmin` sur env A et `paperAdmin` sur catalogue B).
- **`PermissionMatrix`** : configuration métier action → `allowedRoles` + `requiredScope`. Support d'une exigence 2FA (`requires2FA`).
- **`Invitation`** : workflow d'onboarding avec token haché, expiration, statut (`pending`/`accepted`/`revoked`/`expired`).

### 3.4 Règles de sécurité
- L'`Owner` d'un tenant ne peut être supprimé/dégradé que par un autre Owner.
- Les actions sensibles (publication, révocation de partage, migration) sont journalisées dans `AuditLog`.
- Les tokens de partage sont stockés sous forme de hash SHA-256 (`ShareLog.token_hash`).

---

## 4. Flux Opérationnels

### 4.1 Flux de création d'environnement (Onboarding)
```
TenantAdmin/BUAdmin
  → Crée BU (isoCurrency, unitSystem)
  → Invite buAdmin (Invitation → token)
  → buAdmin crée PrinterEnvironment (CreateEnvironment wizard)
     → StepGeneralInfo → StepAgrements → StepMachines → StepCatalogues → StepFinal
  → PrinterEnvironment en statut "modification"
```

### 4.2 Flux de configuration des machines
```
PrinterAdmin
  → Ouvre EditEnvironment → TabMachines
  → Ajoute/édite Machine (type_poste, capacités physiques)
  → Édite baremes (TabMachineBaremes)
     → Définit type_prestation, conditions (supports/grammages/formats)
     → Saisit cout_fixe, cout_1000ex, cadences, majorations, gâches
  → Sauvegarde (debounce inline pour éviter la perte de focus)
```

### 4.3 Flux de chiffrage (Test)
```
ProjectUser / ProjectAdmin
  → Sélectionne ProjectEnvironment (activePrinterIds, activePaperSupplierIds)
  → Définit caractéristiques (ProjetTest.caracteristiques)
  → Lance le calcul (moteur de coûts)
  → Résultats stockés (ProjetTest.resultats)
  → Détail consultable (DetailCalculModal)
```

### 4.4 Flux de mise à jour des barèmes
```
PrinterAdmin
  → Édition inline des coûts (cout_fixe, cout_1000ex, etc.)
  → Champs non-nuls/non-zéro affichés dans la liste
  → Sauvegarde batch (bulk) avec debounce
  → AuditLog trace la modification (before/after)
```

### 4.5 Flux de partage externe (Fournisseur)
```
BUAdmin / PrinterAdmin
  → Génère share_token (CreateShareModal)
  → Définit role (SupplierViewer/Editor/Tester) + scopes + expiration
  → ShareLog enregistre token_hash + metadata
  → Fournisseur reçoit lien → ShareLogin → ShareCodeVerification
  → Accès à SharedEnvironment (données filtrées par scopes)
  → Révocation possible (ShareLog.revoked = true)
```

### 4.6 Flux de publication (Versioning)
```
BUAdmin
  → Valide l'environnement (statut "validation" → "prod")
  → Crée CatalogueEnvironnement (snapshot complet dans data_snapshot)
  → Période de validité (date_debut_validite / date_fin_validite)
  → Statut "en production" → consultable pour les chiffrages
  → Archivage possible ("archive")
```

### 4.7 Flux d'approvisionnement papier
```
PaperAdmin
  → Maintient MaterialSupplier (référentiel fournisseur)
  → Gère MaterialBrand (marques + certifications écologiques/digitales)
  → Saisit MaterialSku (référence article)
     → basePrice + 3 paliers dégressifs (break1/2/3 + price1/2/3)
  → Associe via BuPaperSupplier (isDefault, priority)
  → CataloguePapier gère la période de validité des tarifs
```

### 4.8 Flux de transport
```
BUAdmin
  → Définit GrilleTransport (type_transport, delai_garanti)
  → Saisit tranches_poids + tarifs (objet mappé)
  → Frais annexes (enlevement, hayon, gasoil, dépassement)
  → TransportCarrier pour le référentiel transporteurs
```

---

## 5. Modèle de Coûts (Cost Model Engine)

### 5.1 Hiérarchie des coûts atomiques

Le moteur calcule le coût d'une prestation en parcourant l'arbre suivant :

#### A. Coûts Fixes (Machine & Setup)
- **Coût de calage** : `baremes.cout_fixe`
- **Gâche fixe** : `baremes.gache_fixe` × prix_papier_unitaire (si `compter_gaches_calage` = true)
- **Impact machine** : lié au `type_poste` (setup spécifique offset/digital/rotative)

#### B. Coûts Variables (Production & Matière)
- **Impression/Façonnage** : `(nb_exemplaires / 1000) × baremes.cout_1000ex`
- **Gâche roulée** : `(nb_exemplaires × baremes.gache_roule_pct) × prix_papier_unitaire` (si `compter_gaches_roulage` = true)
- **Suppléments** : `baremes.supp_m2` × surface, `baremes.supp_tx_horaire` × temps
- **Majorations** : `majoration_cout_1000ex` (%), `majoration_cout_m2` (%) appliquées sur les coûts de base

#### C. Frais de Structure (Overhead)
- **Main d'œuvre** : `temps_production × PrinterEnvironment.taux_horaire_main_oeuvre`
- **Frais généraux** : `surface_produit × PrinterEnvironment.cout_frais_generaux_m2`
- **Énergie** : `temps_production × puissance_machine × PrinterEnvironment.cout_kwh`

#### D. Gâches de façonnage (Brochure)
- Gâches par palier d'exemplaires : `gache_faconnage_1000ex`, `_5000ex`, `_20000ex`, `_plus20000ex`
- Activées par `compter_gache_faconnage_brochure` = true

### 5.2 Sélection du barème applicable

Pour une prestation donnée, le moteur filtre les `baremes` de la machine selon :
- `type_prestation` (ex: "Impression recto/verso")
- `type_support_1/2/3` (OU logique)
- `grammage_support_min/max` vs grammage du support
- `largeur_produit_min/max`, `hauteur_produit_min/max` vs format du produit fini
- `nb_pages_min/max`, `nb_exemplaire_min/max`

Le **premier barème** dont toutes les conditions sont satisfaites est appliqué.

### 5.3 Marge & Prix de vente

#### Couches de marge (par ordre de priorité)
1. **`ProjectEnvironment.marginRules`** (priorité haute) : règles par `costPost` (paper/print/finishing/packaging/shipping) avec `threshold` et `marginRate`.
2. **`PrinterEnvironment` marges par défaut** (fallback) :
   - `marge_papier` (%)
   - `marge_prestation_interne` (%)
   - `marge_sous_traitance` (%)
   - `marge_livraison` (%)

#### Algorithme
```
Pour chaque costPost (paper, print, finishing, packaging, shipping) :
  coût_catégorie = somme des coûts atomiques du poste
  Règle = ProjectEnvironment.marginRules.find(r => r.costPost == costPost && coût_catégorie > r.threshold)
  Si Règle trouvée :
    marge_appliquée = Règle.marginRate
  Sinon :
    marge_appliquée = PrinterEnvironment.marge_<poste>
  prix_vente_catégorie = coût_catégorie × (1 + marge_appliquée)

Prix_Vente_Total = Σ prix_vente_catégorie
```

#### Application différenciée
- `applyInResults` : la marge apparaît dans les résultats affichés à l'utilisateur.
- `applyInApi` : la marge est appliquée dans les réponses API externes (chiffrage automatisé).

### 5.4 Variables du moteur

| Variable | Source | Unité |
|----------|--------|-------|
| `cout_fixe` | Machine.baremes | € |
| `cout_1000ex` | Machine.baremes | €/1000 ex |
| `gache_fixe` | Machine.baremes | unités |
| `gache_roule_pct` | Machine.baremes | % |
| `limitation_cadence` | Machine.baremes | m/min ou ex/h |
| `taux_horaire_main_oeuvre` | PrinterEnvironment | €/h |
| `cout_frais_generaux_m2` | PrinterEnvironment | €/m² |
| `cout_kwh` | PrinterEnvironment | €/kWh |
| `basePrice` + paliers | MaterialSku | € (par unité/1000/m²/kg/T) |
| `tarifs` (tranches) | GrilleTransport | € par tranche de poids |

---

## 6. Dictionnaire des Données — Annexe Exhaustive

### 6.1 Structure Organisationnelle

#### Entity: `BU`
Business Unit — racine organisationnelle et monétaire.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID du tenant (isolation multi-tenant) |
| `name` | string | ✅ | Nom de la Business Unit |
| `isoCountry` | string | ✅ | Code pays ISO 3166-1 alpha-2 (`^[A-Z]{2}$`) |
| `isoCurrency` | enum | ✅ | EUR, USD, GBP, CHF, CAD (défaut: EUR) |
| `unitSystem` | enum | ✅ | SI, Imperial (défaut: SI) |

#### Entity: `TenantMembership`
Rattachement utilisateur → tenant.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID du tenant |
| `userId` | string | ✅ | ID utilisateur (User entity) |
| `role` | enum | ✅ | tenantAdmin, buAdmin, buPrinterAdmin, buPaperAdmin, buProjectAdmin, printerAdmin, paperAdmin, projectUser |
| `isOwner` | boolean | | Propriétaire (immunité de suppression) |
| `status` | enum | | active, suspended, invited |
| `invitedBy` | string | | ID de l'inviteur |
| `invitedAt` | date-time | | Date d'invitation |
| `lastActiveAt` | date-time | | Dernière activité |
| `twoFactorEnabled` | boolean | | 2FA activé |

#### Entity: `RoleGrant`
Grant de permission à portée fine (cumul de rôles).

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID du tenant |
| `userId` | string | ✅ | Bénéficiaire |
| `role` | enum | ✅ | Rôle accordé (cf. TenantMembership.role) |
| `scopeType` | enum | ✅ | TENANT, BU, PRINTER_ENV, PAPER_ENV, PROJECT_ENV |
| `scopeId` | string | | ID ressource cible (null pour TENANT) |
| `grantedBy` | string | | Accordeur |
| `grantedAt` | date-time | | Date d'attribution |
| `expiresAt` | date-time | | Expiration optionnelle |
| `status` | enum | | active, revoked, expired |
| `notes` | string | | Notes |

#### Entity: `PermissionMatrix`
Configuration métier des droits.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | Règles custom par tenant |
| `action` | string | ✅ | Action (ex: 'invite.tenantAdmin', 'create.bu') |
| `allowedRoles` | array[string] | ✅ | Rôles autorisés |
| `requiredScope` | enum | ✅ | TENANT, BU, PRINTER_ENV, PAPER_ENV, PROJECT_ENV, OWNER |
| `requires2FA` | boolean | | Exige 2FA |
| `description` | string | | Description |
| `isActive` | boolean | | Actif |

#### Entity: `Invitation`
Workflow d'onboarding.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | Tenant cible |
| `email` | email | ✅ | Email invité |
| `role` | enum | ✅ | Rôle proposé |
| `scopeType` | enum | ✅ | Portée |
| `scopeId` | string | | ID portée (null pour TENANT) |
| `token` | string | ✅ | Token haché |
| `invitedBy` | string | ✅ | Inviteur |
| `invitedAt` | date-time | | Date |
| `expiresAt` | date-time | | Expiration |
| `status` | enum | | pending, accepted, revoked, expired |
| `acceptedAt` | date-time | | Date d'acceptation |
| `acceptedBy` | string | | User créé |

---

### 6.2 Production & Environnements

#### Entity: `PrinterEnvironment`
Site de production. Contient les règles métiers globales.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `nom` | string | ✅ | Nom du site |
| `actif` | boolean | | Environnement activé |
| `status` | enum | | prod, modification, validation (défaut: modification) |
| `email_admin` | email | | Email admin |
| `share_token` | string | | Token de partage |
| `share_expires_at` | date | | Expiration partage |
| `share_created_by` | string | | Créateur du partage |
| `adresse` | string | | Adresse |
| `code_postal` | string | | CP |
| `ville` | string | | Ville |
| `codes_iso_zones` | array[string] | | Zones géographiques |
| `siren` | string | | SIREN |
| `code_monnaie` | enum | | EUR, USD, GBP, CHF, CAD |
| `systeme_unite` | enum | | SI, Imperial |
| `agrements` | object | | Certifications (IMPRIM_VERT, FSC, PEFC, ISO_9001/9002/12647/14001/EMAS, FSC_PEFC_DO, PRINT_ENVIRONNEMENT) |
| `machines` | array[object] | | Liste machines (legacy / cache) |
| `acheteurs_papier` | array[string] | | Acheteurs liés |
| `transporteurs` | array[string] | | Transporteurs liés |
| `acheteurs_test` | array[string] | | Acheteurs en mode test |
| `transporteurs_test` | array[string] | | Transporteurs en mode test |
| `gestion_papier` | enum | | Au mieux, Imprimeur uniquement, Client uniquement, Imprimeur de préférence |
| `autoriser_regle_payant_pour` | boolean | | Autoriser règle "payant pour" |
| `fonds_perdus_fiches` | number | | Fonds perdus (fiches) |
| `fonds_perdus_chemises` | number | | Fonds perdus (chemises) |
| `compter_gaches_calage` | boolean | | Compter gâches de calage |
| `compter_gaches_roulage` | boolean | | Compter gâches de roulage |
| `compter_gache_faconnage_brochure` | boolean | | Compter gâches de façonnage |
| `gache_faconnage_1000ex` | number | | Gâche façonnage ≤ 1000 ex |
| `gache_faconnage_5000ex` | number | | Gâche façonnage ≤ 5000 ex |
| `gache_faconnage_20000ex` | number | | Gâche façonnage ≤ 20000 ex |
| `gache_faconnage_plus20000ex` | number | | Gâche façonnage > 20000 ex |
| `refendre_avant_rainage` | boolean | | Refendre avant rainage |
| `refendre_avant_rainage_vernis` | boolean | | Refendre avant rainage vernis |
| `rainage_depliants_paralleles` | number | | Rainage dépliants parallèles (défaut: 170) |
| `rainage_depliants_croises` | number | | Rainage dépliants croisés (défaut: 170) |
| `rainage_cahiers_brochure` | number | | Rainage cahiers brochure (défaut: 170) |
| `rainage_vernis_uv` | number | | Rainage vernis UV (défaut: 170) |
| `rainage_pelliculage` | number | | Rainage pelliculage (défaut: 170) |
| `taux_horaire_main_oeuvre` | number | | €/h |
| `cout_frais_generaux_m2` | number | | €/m² |
| `cout_kwh` | number | | €/kWh |
| `marge_prestation_interne` | number | | % |
| `marge_sous_traitance` | number | | % |
| `marge_papier` | number | | % |
| `marge_livraison` | number | | % |

#### Entity: `BuPrinterEnvironment`
Table pivot BU ↔ PrinterEnvironment.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `printerEnvironmentId` | string | ✅ | ID env imprimeur |
| `isDefault` | boolean | | Imprimeur par défaut |
| `priority` | number | | Ordre de priorité |

#### Entity: `Machine`
Équipement de production + barèmes.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `environment_id` | string | ✅ | Env de rattachement |
| `type_poste` | enum | ✅ | 23 types (presse offset feuille, presse numérique feuille, grand format flat bed, etc.) |
| `marque` | string | | Marque |
| `nom_poste` | string | ✅ | Nom du poste |
| `actif` | boolean | | Actif |
| `types_support` | array[string] | | Supports acceptés |
| `nombre_debobineurs` | number | | Nb débobineurs |
| `diametre_maxi_bobine` | number | | Ø max bobine |
| `diametre_mandrin` | number | | Ø mandrin |
| `largeur_min/max` | number | | Largeurs acceptées |
| `hauteur_min/max` | number | | Hauteurs acceptées |
| `epaisseur_min/max` | number | | Épaisseurs acceptées |
| `grammage_min/max` | number | | Grammages acceptés |
| `prise_pince` | number | | Prise de pince |
| `blanc_fin_pression` | number | | Blanc fin de pression |
| `bord_feuille` | number | | Bord de feuille |
| `hauteur_gamme_bruner` | number | | Hauteur de gamme Bruner |
| `methodes_impression` | array[string] | | Méthodes |
| `combinaisons_teintes` | array[string] | | Combinaisons de teintes |
| `technologie_impression` | string | | Technologie |
| `vernis_ligne` | array[string] | | Vernis en ligne |
| `faconnage_presse_feuille` | array[string] | | Façonnages presse feuille |
| `faconnage_typo` | array[string] | | Façonnages typo |
| `pliage` | array[string] | | Pliages |
| `faconnage_rotative` | array[string] | | Façonnages rotative |
| `faconnage_decoupe` | array[string] | | Façonnages découpe |
| `assemblage` | array[string] | | Assemblages |
| `brochage` | array[string] | | Brochages |
| `faconnage_table` | array[string] | | Façonnages table |
| `baremes` | array[object] | | **Voir structure barème ci-dessous** |

##### Structure détaillée d'un `bareme` (Machine.baremes[])
| Champ | Type | Description |
|-------|------|-------------|
| `type_prestation` | string | ✅ Type de prestation (ex: "Impression recto/verso") |
| `type_support_1/2/3` | string | 3 supports acceptés (OU logique) |
| `grammage_support_min/max` | number | Grammage support (g/m²) |
| `epaisseur_support_min/max` | number | Épaisseur support (µm) |
| `largeur_support_min/max` | number | Largeur support (mm) |
| `hauteur_support_min/max` | number | Hauteur support (mm) |
| `largeur_produit_min/max` | number | Largeur produit fini (mm) |
| `hauteur_produit_min/max` | number | Hauteur produit fini (mm) |
| `epaisseur_produit_min/max` | number | Épaisseur produit fini (mm) |
| `surface_min/max` | number | Surface (m²) |
| `nb_pages_min/max` | integer | Nb pages |
| `nb_postes_min/max` | integer | Nb postes |
| `nb_passe_min/max` | integer | Nb passes |
| `nb_exemplaire_min/max` | integer | Nb exemplaires |
| `cout_fixe` | number | Coût fixe (€) |
| `cout_1000ex` | number | Coût pour 1000 ex (€) |
| `limitation_cadence` | number | Cadence max (m/min ou ex/h) |
| `supp_tx_horaire` | number | Supplément taux horaire (€/h) |
| `supp_m2` | number | Supplément m² (€/m²) |
| `majoration_cout_1000ex` | number | Majoration coût 1000ex (%) |
| `variation_cadence` | number | Variation cadence (%) |
| `majoration_tx_horaire` | number | Majoration taux horaire (%) |
| `majoration_cout_m2` | number | Majoration coût m² (%) |
| `gache_fixe` | integer | Gâche fixe (unités) |
| `gache_roule_pct` | number | Gâche roulée (%) |

---

### 6.3 Matières & Approvisionnement

#### Entity: `MaterialSupplier`
Référentiel fournisseur de matières.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `name` | string | ✅ | Nom |
| `nameNorm` | string | ✅ | Normalisé (trim, lowercase, sans accents) |
| `vatNumber` | string | | N° TVA |
| `address` | string | | Adresse |
| `email` | email | | Contact |
| `websiteUrl` | uri | | Site web |
| `unitSystem` | enum | | SI, imperial |
| `currency` | string | | Devise ISO 4217 |

#### Entity: `PaperSupplier`
Fournisseur de papier (vue spécifique).

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `name` | string | ✅ | Nom |
| `type` | enum | | distributor, manufacturer, other |
| `contactEmail` | email | | Contact |
| `contactPhone` | string | | Téléphone |
| `website` | uri | | Site web |
| `notes` | string | | Notes internes |
| `meta` | object | | Métadonnées additionnelles |

#### Entity: `BuPaperSupplier`
Table pivot BU ↔ PaperSupplier.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `paperSupplierId` | string | ✅ | ID fournisseur papier |
| `isDefault` | boolean | | Fournisseur par défaut |
| `priority` | number | | Priorité |

#### Entity: `MaterialBrand`
Référentiel des marques de matières.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `uid` | string | | ID fonctionnel (import/export) |
| `name` | string | ✅ | Nom de marque |
| `supplier` | string | ✅ | Fournisseur |
| `materialType` | integer 0-26 | | Type de matière (0=indéfini, 1=papiers couchés LWC, etc.) |
| `famille` | string | | Famille (texte libre) |
| `familleNorm` | string | | Famille normalisée |
| `fireRating` | object | | { M1: boolean } |
| `digitalPressCert` | object | | { Canon, HP, Kodak, KonicaMinolta, Ricoh, Xeikon, Xerox: boolean, Others: array[string] } |
| `printProcesses` | object | | { Numerique, Offset, OffsetUV, Coldset, Heliogravure, Serigraphie, Flexographie: boolean } |
| `ecoCert` | object | | { PEFC100, PEFCRecycle, PEFC70, FSC100, FSCRecycle, FSCMix, Recycle, BlueAngel, Ecolabel, NordicSwan, APUR, PaperByNature: boolean } |

#### Entity: `MaterialSku`
Référence article précise (SKU).

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `supplierName` | string | ✅ | Nom fournisseur |
| `supplierNameNorm` | string | ✅ | Normalisé |
| `sku` | string | ✅ | Code fournisseur |
| `brand` | string | | Marque (référentiel) |
| `brandNorm` | string | | Marque normalisée |
| `label` | string | | Libellé descriptif |
| `supportType` | enum | | F (Feuille), B (Bobine), P (Plaque), FF, BF, PF (Fabrication) |
| `color` | string | | Couleur |
| `grammage` | number | | Grammage |
| `grammageUnit` | enum | | g/m2 |
| `thickness` | number | | Épaisseur |
| `thicknessUnit` | enum | | micron, mm, point |
| `widthOrWeb` | number | | Largeur ou laize |
| `heightOrRollLength` | number | | Hauteur ou longueur bobine |
| `dimUnit` | enum | | mm, cm, m |
| `qtyPerPack` | integer | | Quantité par conditionnement |
| `minOrder` | number | | Commande minimum |
| `minOrderUnit` | enum | | unite, 1000 unites, conditionnement, ml, m2, kg, T, unite monetaire |
| `basePrice` | number | | Prix de base |
| `priceUnit` | enum | | par unite, pour 1000 unites, par conditionnement, ml, m2, kg, T |
| `discountPct` | number | | Remise (%) |
| `break1` | number | | Seuil palier 1 |
| `break1Type` | enum | | si moins de/plus de X UM ou X T |
| `price1` | number | | Prix/variation palier 1 |
| `price1Type` | enum | | supplément ou remise fixe, variation % |
| `break2` | number | | Seuil palier 2 |
| `break2Type` | enum | | idem |
| `price2` | number | | Prix/variation palier 2 |
| `price2Type` | enum | | idem |
| `break3` | number | | Seuil palier 3 |
| `break3Type` | enum | | idem |
| `price3` | number | | Prix/variation palier 3 |
| `price3Type` | enum | | idem |

#### Entity: `CataloguePapier`
Période de validité d'un catalogue papier.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `environment_id` | string | ✅ | Env de rattachement |
| `nom` | string | ✅ | Nom du catalogue |
| `date_debut` | date | | Début validité |
| `date_fin` | date | | Fin validité |
| `actif` | boolean | | Actif |
| `references` | array[object] | | Références papier |

---

### 6.4 Logistique & Transport

#### Entity: `GrilleTransport`
Tarif de livraison structuré.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `environment_id` | string | ✅ | Env de rattachement |
| `nom` | string | ✅ | Nom |
| `type_transport` | enum | | messagerie, VL/fourgon/camion sans hayon, avec hayon en option, camion avec hayon |
| `delai_garanti` | enum | | demi-journée, j+1 avant 10h/13h/18h, 24/48h, 72h, >72h |
| `actif` | boolean | | Actif |
| `poids_min/max` | number | | Poids bornes |
| `dimension_max` | number | | Dimension max |
| `perimetre_max` | number | | Périmètre max |
| `volume_max` | number | | Volume max |
| `frais_enlevement` | number | | Frais d'enlèvement |
| `minimum_forfaitaire` | number | | Minimum forfaitaire |
| `frais_fixe` | number | | Frais fixes |
| `taxe_gasoil` | number | | Taxe gasoil |
| `type_tarification` | enum | | forfaitaire, tarif à la tonne |
| `supplement_hayon` | number | | Supplément hayon |
| `supplement_depassement` | number | | Supplément dépassement |
| `majoration_depassement` | number | | Majoration dépassement |
| `tranches_poids` | array[number] | | Bornes des tranches |
| `tarifs` | object | | Map { clé: array[number] } — tarifs par tranche |

---

### 6.5 Projets & Chiffrage

#### Entity: `ProjectEnvironment`
Configuration projet client.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `name` | string | ✅ | Nom du projet |
| `externalApiKey` | string | | Clé API externe (hachée) |
| `externalApiKeyHash` | string | | Hash SHA-256 pour validation |
| `activePrinterIds` | array[string] | | Imprimeurs actifs pour ce projet |
| `activePaperSupplierIds` | array[string] | | Fournisseurs papier actifs |
| `marginRules` | array[object] | | Règles de marge par poste de coût |

##### Structure d'une `marginRule` (ProjectEnvironment.marginRules[])
| Champ | Type | Description |
|-------|------|-------------|
| `costPost` | enum ✅ | paper, print, finishing, packaging, shipping |
| `threshold` | number ✅ | Seuil de déclenchement (devise BU) |
| `marginRate` | number ✅ | Taux 0–1 (ex: 0.15 = 15%) |
| `applyInResults` | boolean | Appliquer dans les résultats affichés |
| `applyInApi` | boolean | Appliquer dans les réponses API externes |

#### Entity: `ProjetTest`
Bac à sable de chiffrage.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `environment_id` | string | ✅ | Env de rattachement |
| `nom` | string | ✅ | Nom du test |
| `date` | date-time | | Date du test |
| `type` | enum | | prod, test, RSP (défaut: test) |
| `caracteristiques` | object | | Caractéristiques techniques (dynamique) |
| `resultats` | object | | Résultats du calcul (dynamique) |

---

### 6.6 Versioning & Administration

#### Entity: `CatalogueEnvironnement`
Snapshot versionné d'un environnement.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `environment_id` | string | ✅ | Env source |
| `auteur` | string | | Auteur |
| `commentaire` | string | ✅ | Commentaire |
| `date_debut_validite` | date | ✅ | Début validité |
| `date_fin_validite` | date | ✅ | Fin validité |
| `statut` | enum | | à valider, en production, archive |
| `data_snapshot` | object | | Snapshot complet de la configuration |

---

### 6.7 Audit & Partage

#### Entity: `AuditLog`
Historique immuable des actions.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `ts` | date-time | ✅ | Timestamp |
| `actorId` | string | ✅ | Acteur |
| `actorRole` | enum | ✅ | DatabaseAdmin, BUAdmin, SupplierEditor, SupplierTester, Viewer |
| `tenantId` | string | ✅ | Tenant |
| `buId` | string | ✅ | BU |
| `entity` | string | ✅ | Type d'entité affectée |
| `entityId` | string | | ID enregistrement |
| `action` | enum | ✅ | create, update, delete, publish, revoke, share, redeem, test.run, import, export, migration.execute |
| `before` | object | | État avant (JSON) |
| `after` | object | | État après (JSON) |
| `notes` | string | | Notes |
| `ip` | string | | IP acteur |

#### Entity: `ShareLog`
Traçabilité des partages externes.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `tenantId` | string | ✅ | ID tenant |
| `buId` | string | ✅ | ID BU |
| `environment_id` | string | ✅ | Env partagé |
| `token_hash` | string | ✅ | SHA-256 du token |
| `role` | enum | | SupplierViewer, SupplierEditor, SupplierTester |
| `scopes` | array[string] | | Scopes autorisés |
| `expires_at` | date-time | | Expiration |
| `created_by` | string | | Créateur |
| `revoked` | boolean | | Révoqué |

---

## 7. Règles Transversales & Conventions

### 7.1 Multi-tenant & Scoping
- **Toutes** les entités métier portent `tenantId` (isolation) et, le cas échéant, `buId` (scoping BU).
- Les tables pivot (`BuPaperSupplier`, `BuPrinterEnvironment`) gèrent les associations N-N avec priorité.

### 7.2 Normalisation
- Les noms de fournisseurs (`nameNorm`, `supplierNameNorm`) et marques (`brandNorm`) sont normalisés (trim, lowercase, sans accents) pour garantir l'unicité et la recherche.
- Les familles de matières (`familleNorm`) suivent la même logique.

### 7.3 Typage strict
- Les statuts, types de machines, devises, unités et types de supports sont des enums — garantissant l'intégrité des calculs.
- Les dates respectent ISO 8601 (`date` ou `date-time`).

### 7.4 Affichage des coûts (règle UI)
- Les champs de coût ne sont affichés dans les listes que s'ils sont **non-nuls et non-zéro**.
- **Exceptions** : le taux horaire (`taux_horaire_main_oeuvre`) et la cadence (`limitation_cadence`) sont toujours affichés (champs structurants).

### 7.5 Édition inline
- Les coûts des barèmes sont édités inline avec **debounce** pour éviter les re-renders et la perte de focus.
- Les composants d'édition sont **isolés** du parent pour garantir la persistance du focus clavier.

### 7.6 Versioning & Publication
- Un environnement passe par les statuts : `modification` → `validation` → `prod`.
- La publication crée un `CatalogueEnvironnement` avec `data_snapshot` complet et une période de validité.
- L'archivage conserve l'historique pour audit.

### 7.7 Sécurité & Tokens
- Tokens d'invitation et de partage stockés en **hash SHA-256**.
- Révocation possible (`ShareLog.revoked`, `Invitation.status = revoked`).
- Expiration gérée par `expiresAt` / `share_expires_at`.

---

## 8. Points de Vigilance & Roadmap

### 8.1 Points de vigilance métier
1. **Traitement des gâches** : Les booléens `compter_gaches_calage`, `compter_gaches_roulage`, `compter_gache_faconnage_brochure` déterminent si la gâche est ajoutée (on imprime plus) ou déduite (perte sur résultat). **À valider** : le sens exact de calcul pour chaque type.
2. **Priorité des marges** : Si une marge est définie à la fois sur `ProjectEnvironment.marginRules` et sur `PrinterEnvironment.marge_*`, la règle du projet doit l'emporter. **À confirmer** dans l'implémentation du moteur.
3. **Chevauchement de barèmes** : Plusieurs barèmes peuvent matcher une même prestation. La règle "premier match gagne" doit être documentée et ordonnée de façon déterministe.
4. **Unités mixtes** : Le système supporte SI et Imperial. Les conversions doivent être explicites (notamment pour les SKU importés).

### 8.2 Roadmap envisagée
- **Export comptable** : transformer les `AuditLog` de coût en écritures comptables.
- **Analyse de rentabilité réelle vs théorique** : comparer les `ProjetTest.resultats` aux coûts réels de production.
- **Gâche fine** : modéliser la gâche en *ajout* vs *perte* de façon explicite.
- **API de chiffrage** : exposer le moteur de coûts via `ProjectEnvironment.externalApiKey` pour les chiffrages automatisés.
- **Internationalisation** : étendre les enums de devises et certifications.

---

*Document généré à partir de l'analyse exhaustive des entités et des discussions de conception PrintFlow Pro.*