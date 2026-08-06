Voici un **PROMPT UNIQUE** (copier-coller) pour Base44 afin d’ajouter, **au niveau BU**, la **gestion des transporteurs** et des **grilles de transport** (entités, API sécurisée, UI, import/export CSV, RBAC, i18n, audit). Le modèle reprend les patterns déjà déployés (suppliers/SKU, imports dry-run/commit, scoping serveur).

---

## PROMPT BASE44 — BU / Transporteurs + Grilles de transport (import/export, RBAC)

> **Contexte & objectif**
> Par **BU**, permettre au print manager de gérer **ses transporteurs** indépendamment des paramétrages transport côté imprimeurs, et de créer des **grilles de transport** activables avec contraintes, frais globaux, et une **table de tarifs** (zones origine/destination × tranches de poids).
> Périmètre : entités + Functions sécurisées + UI (liste + modal onglets) + import/export CSV (dryRun/commit) + i18n + audit + RBAC.

---

### 1) ENTITIES (scoping strict tenantId/buId)

**`entities/TransportCarrier.json`**

```json
{
  "id": "uuid",
  "tenantId": "string",
  "buId": "string",

  "name": "string",
  "nameNorm": "string",               // trim → sans accents → lower → espaces compressés
  "vatNumber": "string",
  "address": "string",
  "email": "string",
  "websiteUrl": "string",
  "unitSystem": { "type": "enum", "options": [["SI","SI"],["imperial","imperial"]] },
  "currency": "string",               // ISO 4217

  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

* **Unicité** `(tenantId, buId, nameNorm)` ; index idem.

**`entities/TransportRateGrid.json`** — en-tête + paramètres

```json
{
  "id": "uuid",
  "tenantId": "string",
  "buId": "string",
  "carrierId": "uuid|null",           // optionnel: rattacher à un transporteur
  "name": "string",
  "isActive": "boolean",

  "destinationCountryIso": "string|null",  // ISO 3166-1 alpha-2 (optionnel)

  "transportType": { "type":"enum","options":[
    ["messagerie","messagerie"],
    ["vl_no_tail_lift","VL, fourgon ou camion sans hayon"],
    ["vl_tail_lift_option","VL, fourgon, camion, hayon en option"],
    ["truck_tail_lift_included","camion avec hayon inclu"]
  ]},

  "guaranteedLeadTime": { "type":"enum","options":[
    ["half_day","demi-journée (12h/16h)"],
    ["d1_10","j+1 avant 10h"], ["d1_13","j+1 avant 13h"], ["d1_18","j+1 avant 18h"],
    ["24_48","24/48h"], ["72","72h"], ["gt_72",">72h"]
  ]},

  "minWeightKg": "integer",
  "maxWeightKg": "integer",
  "maxOneSideCm": "integer",
  "maxPerimeterCm": "integer",        // h + l + L
  "maxVolumeCm3": "integer",

  "pickupFee": "number",
  "flatMinimum": "number",
  "fixedFee": "number",
  "dieselTaxPct": "number",
  "pricingMode": { "type":"enum","options":[["flat","forfaitaire"],["per_ton","tarif à la tonne"]] },
  "tailLiftOptionSurcharge": "number",
  "oversizeFixedSurcharge": "number",
  "oversizePctMarkup": "number",

  "weightBreaksKg": "number[]",       // ex: [1,5,10,20,30,50,100]

  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

**`entities/TransportRateRow.json`** — lignes (zones + supplément enlèvement + colonnes de tarifs)

```json
{
  "id": "uuid",
  "tenantId": "string",
  "buId": "string",
  "gridId": "uuid",

  "originIso": "string",              // code ISO zone d'enlèvement (pays, région, code interne…)
  "destIso": "string",                // code ISO zone de destination
  "pickupSurcharge": "number",        // supplément d'enlèvement (ligne)

  "pricesByBreak": "number[]",        // même longueur que weightBreaksKg

  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

* Index : `(tenantId, buId, gridId)`, `(gridId, originIso, destIso)` unique.

---

### 2) BACKEND FUNCTIONS (sécurisées, RBAC)

Créer sous `functions/api/transport/*`. **Scoping serveur obligatoire** `(tenantId == ctx.tenantId && buId == ctx.currentBuId)`. **Jamais** faire confiance à tenantId/buId côté client.

#### Transporteurs

* `Carriers.List({search?,page?,pageSize?})`
* `Carriers.Create({name,vatNumber,address,email,websiteUrl,unitSystem,currency})`

  * Normaliser `nameNorm`; 409 si doublon.
* `Carriers.Update({id,patch})` (renormaliser si `name` change)
* `Carriers.Delete({id})` → 409 si des grilles référencent `carrierId`
* `Carriers.Suggest({q?,limit?=20})`
* `Carriers.QualificationStatus({id})` → statut **vert** si `vatNumber,email,websiteUrl,unitSystem,currency` renseignés, **orange** sinon, **rouge** si fiche quasi vide.

#### Grilles

* `Grids.List({search?,carrierId?,isActive?,transportType?,leadTime?,page?,pageSize?})`
* `Grids.Create(header)` → crée `TransportRateGrid` avec `weightBreaksKg: []` par défaut
* `Grids.Update({id, patch})`
* `Grids.ToggleActive({id, isActive})`
* `Grids.Delete({id})` → supprimer aussi les `TransportRateRow` liées (ou refuser si usage ailleurs)

#### Table de tarifs (onglet « Grille des tarifs »)

* `Grids.SetWeightBreaks({id, weightBreaksKg:number[]})`

  * **Valider** croissante & bornes contre `minWeightKg/maxWeightKg`; redimensionner `pricesByBreak` des rows si nécessaire (remplir `null`).
* `Grids.ListRows({gridId, page?, pageSize?, origin?, dest?})`
* `Grids.UpsertRows({gridId, rows:[{originIso,destIso,pickupSurcharge,pricesByBreak[]}]})`
* `Grids.DeleteRow({gridId, originIso, destIso})`

#### Import / Export CSV

* `Grids.ExportCsv({gridId})`

  * Lignes CSV :

    * **Ligne 1** : `originIso,destIso,pickupSurcharge,<break<=X1 kg>,<break<=X2 kg>,...` (Xn = `weightBreaksKg`)
    * **Ligne 2..N** : `FR,DE,12.50,45.00,55.00,...`
  * Inclure un **JSON de méta** en première ligne commentée (ou endpoint séparé) : header (params, contraintes, breaks).
* `Grids.ImportCsv({gridId, file, dryRun?:boolean})`

  * Parse CSV **UTF-8**, déduire `weightBreaksKg` de l’entête si précisée (ou vérifier correspondance).
  * Upsert `TransportRateRow` par `(originIso, destIso)`.
  * **Validation** : nombres, longueurs de tableaux, zones non vides.
  * **Rapport** : JSON + CSV erreurs (dryRun), counters (insert/update/skip/errors).
  * Si `dryRun=false` → commit; log Audit.

> **RBAC**
>
> * Lecture : `tenantAdmin`, `buAdmin`, *(optionnel : `viewer`)*.
> * Écriture (CRUD, import/export) : `tenantAdmin`, `buAdmin` *(optionnel : introduire `buTransportAdmin` si vous exposez un sous-rôle transport — sinon ignorer)*.
> * Toute action sensible **AuditLog**.

---

### 3) UI / UX (BU)

#### Transporteurs — `pages/bu/transport/Carriers.jsx`

* Table : `name`, `vatNumber`, `email`, `websiteUrl`, `unitSystem`, `currency`, **badge qualification** (vert/orange/rouge), Actions (Éditer/Supprimer).
* Recherche plein-texte + tri nom.
* **Modal** `CarrierEditModal.jsx` : création/édition avec validations (email, URL, ISO 4217).
* Clic badge → tooltip d’explication.

#### Grilles — `pages/bu/transport/Grids.jsx`

* Bouton **“Nouvelle grille”**.
* **Liste des grilles** : colonnes

  * **Nom**, **Pays destination** (ou “toutes”), **Type de transport**, **Délai**, **Tranche de poids** (résumé `min–max` + nb breaks), **Activée** (switch), Actions : **Éditer**, **Exporter**, **Supprimer**.
* Filtres : transporteur, type, délai, actif/inactif.

#### **Modal d’édition de grille** — `GridEditModal.jsx` avec **onglets** :

**Onglet “Paramètres”**

* **Informations générales** :

  * Nom (string)
  * Transporteur (select optionnel, via `Carriers.List/Suggest`)
  * Type de transport (select)
  * Délai garanti (select)
  * Destination (select code pays ISO, option “toutes”)
* **Contraintes** : `minWeightKg`, `maxWeightKg`, `maxOneSideCm`, `maxPerimeterCm`, `maxVolumeCm3`
* **Tarifs globaux** : `pickupFee`, `flatMinimum`, `fixedFee`, `dieselTaxPct`, `pricingMode`, `tailLiftOptionSurcharge`, `oversizeFixedSurcharge`, `oversizePctMarkup`
* **Tranches de poids** : éditeur horizontal (chips éditables) → **SetWeightBreaks**; vérifier cohérence avec min/max.

**Onglet “Grille des tarifs”**

* **Fonctions** : Import CSV (dryRun/commit), Export CSV, Enregistrer modifications.
* **Grille éditable** (table virtualisée) :

  * Col 1 : `originIso` (editable)
  * Col 2 : `destIso` (editable)
  * Col 3 : `pickupSurcharge` (editable)
  * Col 4..X : une colonne par **poids max** (depuis `weightBreaksKg`), cellule = **tarif** (editable, nombre).
* Boutons : **Ajouter ligne** (origin/dest/pickup) ; **Supprimer ligne**.
* Toasters en cas d’erreur (longueur `pricesByBreak`, nombres invalides, etc.).

> **Ergonomie**
>
> * Afficher en header un **bandeau** “Portée : BU <name> — Grille <name>”.
> * Lors d’un **changement des breaks**, proposer de remplir les nouvelles colonnes manquantes par `null` ou valeur copiée de la colonne adjacente.

---

### 4) Import/Export CSV — Détail de format

**Export**

* Ligne d’entête :
  `originIso,destIso,pickupSurcharge,<=1kg,<=5kg,<=10kg,<=20kg,…` (les libellés suivent `weightBreaksKg`)
* Une ligne par couple (origin,dest). Valeurs vides → `""`. Décimales avec point.

**Import**

* **dryRun** par défaut → retourne rapport : `rowsParsed, rowsValid, inserts, updates, errors[]` + CSV erreurs (lignes source + raison).
* Si première ligne contient des labels de colonnes de poids différents → **mettre à jour** `weightBreaksKg` **après confirmation** (option `allowBreaksChange=true`).
* Commit si `dryRun=false`.
* Conserver cohérence avec `minWeightKg/maxWeightKg`. Refuser si breaks hors bornes.

---

### 5) i18n (fr/en)

Namespaces `transport.*`, `grids.*`, `carriers.*`, `importExport.*` :

* `carriers.title`, `carriers.edit.title`, `carriers.fields.*`, `carriers.status.green|amber|red`, `carriers.status.hint.*`
* `grids.title`, `grids.new`, `grids.columns.*` (`name`, `destCountry`, `type`, `leadTime`, `weightRange`, `active`, `actions`)
* `grid.edit.tabs.params`, `grid.edit.tabs.table`, `grid.params.*`, `grid.constraints.*`, `grid.globalFees.*`, `grid.breaks.*`
* `grid.table.headers.origin`, `grid.table.headers.dest`, `grid.table.headers.pickup`, `grid.table.headers.weightLE`
* `importExport.grid.csv.import`, `importExport.grid.csv.export`, `importExport.dryRun`, `importExport.reportReady`, `importExport.errors.*` (`invalidNumber`, `invalidBreaks`, `mismatchColumns`, `outOfBounds`, `duplicateRow`)
* Toasters : `grid.saved`, `grid.deleted`, `grid.activated`, `grid.deactivated`.

---

### 6) AUDIT & METRICS

* **AuditLog** :

  * `carriers.create/update/delete`,
  * `grids.create/update/toggle/delete`,
  * `grids.breaks.update`,
  * `grids.rows.upsert/delete`,
  * `grids.csv.{export,import.dryRun,import.commit}`.
* (Optionnel) `Metrics.Get({buId})` : #grilles actives, #couples zones, prix moyen par tranche, % lignes avec surcharge enlèvement.

---

### 7) RBAC

* **Lecture** : `tenantAdmin`, `buAdmin`, *(optionnel `viewer`)*.
* **Écriture** : `tenantAdmin`, `buAdmin`. *(Si vous avez introduit un sous-rôle `buTransportAdmin`, autorisez-le ici ; sinon ignorer)*.
* **UI** : masquer (pas désactiver) les actions non autorisées.

---

### 8) TESTS MANUELS (ajouter à TESTS_README)

1. **Transporteur** : création → statut rouge → compléter champs → statut vert ; édition ; suppression refusée si grille liée.
2. **Grille** : création, set des **breaks**, saisie de 3 lignes (FR→FR, FR→BE, FR→DE) ; toggle **active**.
3. **Contraintes** : breaks hors bornes → erreur claire ; volumes/dimensions invalides → refus.
4. **Import CSV (dryRun)** : format avec head poids ; erreurs lisibles (colonnes manquantes, NaN, doublons origin/dest).
5. **Import CSV (commit)** : upsert lignes ; modifier breaks dans le CSV avec `allowBreaksChange=true` → columns redimensionnées.
6. **Export CSV** : réimporter immédiatement → résultat identique.
7. **RBAC** : un rôle lecture seule ne voit pas les boutons Nouvelle grille / Enregistrer / Import / Supprimer.
8. **Audit** : chaque action visible dans AuditDashboard (grids.* / carriers.*).

---

### 9) Critères d’acceptation (bloquants)

* Scoping serveur `(tenantId,buId)` **enforced** sur toutes les functions.
* Entités & index en place ; unicité transporteur (`nameNorm`) respectée.
* UI : liste transporteurs + **modal** ; liste grilles + **modal avec 2 onglets** (Paramètres, Grille des tarifs).
* Import/Export CSV opérationnels avec **dryRun** + rapports.
* **WeightBreaks** cohérents avec contraintes min/max ; redimensionnement propre des `pricesByBreak`.
* RBAC, i18n, audit conformes ; UX fluide sur grandes grilles (table virtualisée).

> Merci de livrer : endpoints créés, pages & composants, exemples d’export CSV, et un rapport d’import (dryRun).
