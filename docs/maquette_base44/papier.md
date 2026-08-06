Voici un **PROMPT UNIQUE** (copier-coller) pour Base44 afin d’ajouter, au **niveau BU**, la **gestion des fournisseurs de matière** et le **catalogue de SKU** (UI + API sécurisée + import/export + RBAC + i18n + audit). Il respecte ton référentiel “marques simplifié” (famille = texte libre, materialType enum).

---

## PROMPT BASE44 — BU / Fournisseurs matière + Catalogue SKU (import/export, filtres, RBAC)

> **Contexte & objectif**
> Par BU, implémenter :
>
> 1. **Fournisseurs de matière** : liste + modal création/édition, statut de qualification.
> 2. **Catalogue SKU** : tri/recherche multi-critères, liste, import intégral (création/MAJ), import tarif (MAJ pricing), export (même format que l’import intégral).
>    Intégration avec le **référentiel marques** simplifié : `materialType` (enum) & `famille` (texte). Si marque inconnue → **création auto** avec normalisation.

---

### 1) ENTITIES (scoping serveur strict tenantId/buId)

**`entities/MaterialSupplier.json`**

```json
{
  "id": "uuid",
  "tenantId": "string",
  "buId": "string",
  "name": "string",                // affiché
  "nameNorm": "string",            // interne: trim, no accents, lower, collapse spaces
  "vatNumber": "string",
  "address": "string",
  "email": "string",
  "websiteUrl": "string",
  "unitSystem": { "type": "enum", "options": [["SI","SI"],["imperial","imperial"]] },
  "currency": "string",            // ISO 4217
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

* Unicité : `(tenantId, buId, nameNorm)` unique.
* Index : `(tenantId, buId, nameNorm)`.

**`entities/MaterialSku.json`**

```json
{
  "id": "uuid",
  "tenantId": "string",
  "buId": "string",
  "supplierName": "string",
  "supplierNameNorm": "string",        // pour jointure/suggestions
  "sku": "string",                     // code fournisseur
  "brand": "string",                   // nom de marque (référentiel)
  "brandNorm": "string",
  "label": "string",
  "supportType": { "type":"enum", "options":[["F","Feuille"],["B","Bobine"],["P","Plaque"],["FF","Feuille sur fabrication"],["BF","Bobine sur fabrication"],["PF","Plaque sur fabrication"]] },
  "color": "string",
  "grammage": "number",
  "grammageUnit": { "type":"enum", "options":[["g/m2","g/m2"]] },
  "thickness": "number",
  "thicknessUnit": { "type":"enum", "options":[["micron","micron"],["mm","mm"],["point","point"]] },
  "widthOrWeb": "number",
  "heightOrRollLength": "number",
  "dimUnit": { "type":"enum", "options":[["mm","mm"],["cm","cm"],["m","m"]] },
  "qtyPerPack": "integer",

  "minOrder": "number",
  "minOrderUnit": { "type":"enum", "options":[["unite","unite"],["1000 unites","1000 unites"],["conditionnement","conditionnement"],["ml","ml"],["m2","m2"],["kg","kg"],["T","T"],["unite monetaire","unite monetaire"]] },
  "basePrice": "number",
  "priceUnit": { "type":"enum", "options":[["par unite","par unite"],["pour 1000 unites","pour 1000 unites"],["par conditionnement","par conditionnement"],["ml","ml"],["m2","m2"],["kg","kg"],["T","T"]] },

  "discountPct": "number",

  "break1": "number",
  "break1Type": { "type":"enum", "options":[
    ["si moins de X UM","si moins de X UM"],["si plus de X UM","si plus de X UM"],
    ["si moins de X T","si moins de X T"],["si plus de X T","si plus de X T"]] },
  "price1": "number",
  "price1Type": { "type":"enum", "options":[["supplément ou remise fixe","supplément ou remise fixe"],["variation %","variation %"]] },

  "break2": "number",
  "break2Type": { "type":"enum", "options":[
    ["si moins de X UM","si moins de X UM"],["si plus de X UM","si plus de X UM"],
    ["si moins de X T","si moins de X T"],["si plus de X T","si plus de X T"]] },
  "price2": "number",
  "price2Type": { "type":"enum", "options":[["supplément ou remise fixe","supplément ou remise fixe"],["variation %","variation %"]] },

  "break3": "number",
  "break3Type": { "type":"enum", "options":[
    ["si moins de X UM","si moins de X UM"],["si plus de X UM","si plus de X UM"],
    ["si moins de X T","si moins de X T"],["si plus de X T","si plus de X T"]] },
  "price3": "number",
  "price3Type": { "type":"enum", "options":[["supplément ou remise fixe","supplément ou remise fixe"],["variation %","variation %"]] },

  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

* **Unique key** : `(tenantId, buId, supplierNameNorm, sku)` unique.
* Index : `(tenantId, buId, brandNorm)`, `(tenantId, buId, supportType)`, `(tenantId, buId, color)`.

> **Note référentiel marques** : nous utilisons la version **simplifiée** :
> `MaterialBrand = { name, nameNorm, materialType(enum), famille(text), familleNorm, … }`. Si `brand` inconnue lors d’un import intégral → **création auto** (avec `materialType`/`famille` si fournis).

---

### 2) BACKEND FUNCTIONS (sécurisées, RBAC)

Créer sous `functions/api/materialSuppliers/*` et `functions/api/materialSkus/*`. **Scoping serveur obligatoire** `(tenantId == ctx.tenantId && buId == ctx.currentBuId)`.

**Fournisseurs**

* `Suppliers.List({ search?, page?, pageSize? })`
* `Suppliers.Create({ name, vatNumber, address, email, websiteUrl, unitSystem, currency })`

  * Normaliser `nameNorm`. Si `nameNorm` existe déjà → 409.
* `Suppliers.Update({ id, patch })` → renormaliser si `name` change.
* `Suppliers.Delete({ id })` → refuser 409 si des `MaterialSku` référencent `supplierNameNorm`.
* `Suppliers.Suggest({ q?, limit?=20 })` → noms distincts existants (pour sélecteur créable).
* `Suppliers.QualificationStatus({ id })` → calcule **vert/orange/rouge**:

  * **vert** si `vatNumber`, `email`, `websiteUrl`, `unitSystem`, `currency` **tous** renseignés ;
  * **orange** si au moins un de ces champs est manquant mais `name` renseigné ;
  * **rouge** si au minimum `name` absent (théoriquement impossible) ou fiche quasi vide.

**SKU**

* `Skus.List({ search?, supplier?, materialType?, famille?, brand?, supportType?, color?, grammageMin?, grammageMax?, page?, pageSize?, sort? })`

  * Filtres :

    * `supplier` match sur `supplierNameNorm`,
    * `materialType`/`famille` via **jointure virtuelle** au `MaterialBrand` (par `brandNorm`),
    * `brand` match `brandNorm`,
    * `supportType`, `color`, `grammage` range.
* `Skus.Create(data)` / `Skus.Update({ id, patch })`

  * Normaliser `supplierNameNorm` & `brandNorm`.
  * **Assurer conformité** : si `supplierName` inconnu → créer **MaterialSupplier** minimal (avec normalisation).
  * Si `brand` inconnue → créer **MaterialBrand** (avec `materialType`/`famille` si fournis dans payload).
* `Skus.Delete({ id })`.
* **Import/Export** :

  * `Skus.Export({ format:"csv"|"json" })` → **format identique à l’import intégral** (voir §4).
  * `Skus.ImportFull({ format, file, mode:"upsert"|"insertOnly"|"replace", dryRun?:bool })`

    * Upsert par `(supplierNameNorm, sku)` ; normaliser noms (trim, capitalisation, **sans accents**), créer fournisseurs/brands au besoin ; possibilité d’**écrire** les champs marque fournis (qualif) si présents (cf. §4).
    * Rapport **JSON + CSV** (erreurs, lignes impactées).
  * `Skus.ImportPrices({ format, file, mode:"upsert", dryRun?:bool })`

    * Clé d’appariement : `(supplierName, sku)` avec normalisation ; ne met à jour **que** les champs tarifs (minOrder, minOrderUnit, basePrice, priceUnit, discountPct, breaks/prices).
    * Rapport JSON + CSV.
  * `Skus.ExportTemplate()` → modèle CSV d’import intégral + doc de mapping.

**RBAC**

* Lecture : `tenantAdmin`, `buAdmin`, `buPaperAdmin`, `paperAdmin`, `viewer`.
* Écriture (CRUD, import/export) : `tenantAdmin`, `buAdmin`, `buPaperAdmin`; `paperAdmin` = **update limité SKU** (pas de delete massif/import replace).
* Toutes actions **AuditLog** : `suppliers.*`, `skus.*`, `skus.import.{full,prices}.{dryRun,commit}`, `skus.export`.

---

### 3) UI / UX (BU)

**Fournisseurs**

* **Page** `pages/bu/materials/Suppliers.jsx`

  * Liste (table) : `name`, `vatNumber`, `email`, `websiteUrl`, `unitSystem`, `currency`, **badge statut** (vert/orange/rouge), action *Éditer*.
  * **Modal** `SupplierEditModal.jsx` : création/édition (tous champs). Validation email/URL/ISO 4217.
  * Recherche plein-texte + tri par nom.
  * i18n & toasts clairs.

**Catalogue SKU**

* **Page** `pages/bu/materials/Skus.jsx` (onglet “Catalogue”)

  * **Filtres** :

    * **Fournisseur** : **sélecteur créable** alimenté par `Suppliers.Suggest()` ; création à la volée ouvre la modal fournisseur (préremplie).
    * **Type de matière** (enum) & **famille** (sélecteur modifiable) → via **MaterialBrand** (suggest sur valeurs existantes par BU).
    * **Marque** : suggest (créable) lié au référentiel marques.
    * **Type de support** (chips), **Couleur**, **Grammage** (range).
  * **Table** virtualisée (perf) :

    * Fournisseur **avec code couleur** (vert/orange/rouge selon qualification) et clic → ouvre `SupplierEditModal`.
    * Marque **avec code couleur** : **vert** si `materialType` non 0 ET `famille` non vide ET ≥1 `printProcesses.*=true` ; **rouge** sinon.
    * SupportType (F/B/P/FF/BF/PF), Couleur, Format (HxL ou Laize), Conditionnement, Mini de commande, Tarif base.
    * Actions ligne : Éditer / Dupliquer / Supprimer (selon droits).
  * **Drawer** `SkuEditDrawer.jsx` : champs de référencement + qualification + tarifs (avec unités).
  * **Panneau Import/Export** :

    * Import intégral (upload, **dryRun**, rendu erreurs, commit).
    * Import tarifs (upload, **dryRun**, commit).
    * Export & Template.

**Normes & normalisation UI**

* Normaliser `supplierName`/`brand` au blur (affichage “tel que saisi” + stockage `*Norm`).
* Tooltips d’aide (unité, prix, bornes).

---

### 4) FORMATS IMPORT/EXPORT

**Import intégral (CSV/JSON)** — *tous champs du SKU* + **qualif marque (optionnel)**

* Référencement SKU :

  * `nomFournisseur` (créable; normalisation trim/capital/sans accents), `SKU`
* SKU (qualif) : `supportType`, `brand`, `label`, `color`, `grammage`, `grammageUnit`, `thickness`, `thicknessUnit`, `widthOrWeb`, `heightOrRollLength`, `dimUnit`, `qtyPerPack`
* **Tarifs** : `minOrder`, `minOrderUnit`, `basePrice`, `priceUnit`, `discountPct`, (break1/price1/type1), (break2/price2/type2), (break3/price3/type3)
* **Qualif marque (optionnel)** :

  * `brand.materialType` (enum/texte tolérant), `brand.famille` (texte),
  * `brand.fire.M1` (bool),
  * `brand.digitalPress.Canon|HP|Kodak|KonicaMinolta|Ricoh|Xeikon|Xerox` (bool), `brand.digitalPress.Others` (liste séparateur `;`),
  * `brand.process.Numerique|Offset|OffsetUV|Coldset|Heliogravure|Serigraphie|Flexographie` (bool),
  * `brand.eco.PEFC100|PEFCRecycle|PEFC70|FSC100|FSCRecycle|FSCMix|Recycle|BlueAngel|Ecolabel|NordicSwan|APUR|PaperByNature` (bool)
* **Règles** :

  * Appariement **upsert** par `(supplierNameNorm, sku)`.
  * Si fournisseur inconnu → **création auto** minimal + normalisation.
  * Si marque inconnue → **création auto** avec champs “brand.*” fournis.
  * Mapping bool : `1/0, true/false, yes/no, y/n`.
  * Erreurs réunies dans **rapport** (CSV+JSON) avec lignes et messages.

**Import tarifs (CSV/JSON)**

* Clé : `nomFournisseur`, `SKU` (normalisation identique).
* Champs pris en compte : uniquement **tarifs** (`minOrder`, `minOrderUnit`, `basePrice`, `priceUnit`, `discountPct`, breaks/prices/types).
* **Upsert** sur les lignes existantes, sinon erreur (option `insertOnMissing=false`).
* Rapport **dryRun/commit**.

**Export**

* Identique à l’import intégral.
* `ExportTemplate()` : en-têtes + exemples commentés.

---

### 5) I18n (fr/en)

Namespaces `suppliers.*`, `skus.*`, `importExport.*` :

* `suppliers.title`, `suppliers.edit.title`, `suppliers.fields.*`, `suppliers.status.green|amber|red`, `suppliers.status.hint.*`
* `skus.title`, `skus.filters.*` (`supplier`, `brand`, `materialType`, `famille`, `supportType`, `color`, `grammage`)
* `skus.columns.*` (`supplier`, `brand`, `supportType`, `color`, `format`, `pack`, `moq`, `basePrice`)
* `skus.edit.*` (toutes les étiquettes et validations)
* `importExport.full.*`, `importExport.prices.*`, `importExport.template`, `importExport.dryRun`, `importExport.reportReady`, `importExport.errors.*` (`unknownMaterialType`, `missingKey`, `invalidUnit`, …)

---

### 6) AUDIT & METRICS

* Audit :

  * `suppliers.create/update/delete`, `skus.create/update/delete`, `skus.import.full.{dryRun,commit}`, `skus.import.prices.{dryRun,commit}`, `skus.export`.
* (Optionnel) Metrics BU : nb suppliers qualifiés (verts), nb SKU actifs, % SKU avec marque “verte”.

---

### 7) RBAC & guards

* Lecture : `tenantAdmin`, `buAdmin`, `buPaperAdmin`, `paperAdmin`, `viewer`.
* Écriture (CRUD, import/export) : `tenantAdmin`, `buAdmin`, `buPaperAdmin`; `paperAdmin` = **update limité** (pas de delete/import replace).
* Masquer les actions non autorisées en UI (pas juste disabled).

---

### 8) TESTS MANUELS (ajouter à TESTS_README)

1. **Fournisseur** : créer → statut rouge → compléter email/TVA/site/unité/monnaie → **vert** ; édition OK ; suppression refusée si SKU liés.
2. **SKU** : création rapide (nouveau fournisseur créé à la volée), normalisation noms ; édition champs ; duplication.
3. **Filtres** : par fournisseur, materialType, famille (select modifiable), marque, supportType, couleur, gramme (range).
4. **Import intégral (dryRun/commit)** : création + MAJ ; marque et fournisseur auto-créés ; rapport erreurs lisible.
5. **Import tarifs** : MAJ prix sans toucher au reste.
6. **Export** : réimporter l’export dans une autre BU → mêmes données (ids différents).
7. **RBAC** : `paperAdmin` update limité ; `viewer` lecture seule.
8. **Audit** : actions visibles avec liens contextuels.

---

### 9) CRITÈRES D’ACCEPTATION

* Scoping serveur `(tenantId, buId)` enforced sur **toutes** les functions.
* Normalisation des noms (fournisseur/marque) cohérente ; unicité respectée.
* Liste fournisseurs + modal opérationnelles ; statut couleur conforme aux règles.
* SKUs : tri/recherche multi-critères fonctionnels, table virtualisée.
* Import/Export : **dryRun** + rapports CSV/JSON, auto-création fournisseur/marque, mapping robuste.
* RBAC, i18n, audit : conformes, UX fluide.

> Merci d’implémenter ces éléments, de livrer les endpoints, pages et composants, et de fournir un **exemple d’export** + un **rapport d’import (dryRun)** en preuve de bon fonctionnement.


Parfait — voici le **PROMPT BASE44** prêt à coller pour ajouter, par **BU**, la **gestion des fournisseurs de matière** et le **catalogue de SKU** (UI + API sécurisée + import/export + filtres + RBAC + i18n + audit). Il suit ton modèle “marques simplifié” (famille texte libre + type de matière enum) et couvre auto-création fournisseur/marque à l’import.

---

## PROMPT BASE44 — BU / Fournisseurs de matière + Catalogue SKU (import/export, filtres, RBAC)

> **Contexte & objectif**
> Par BU, implémenter :
>
> 1. **Fournisseurs de matière** : liste + modal création/édition, statut de qualification (vert/orange/rouge).
> 2. **Catalogue de SKU** : tri/recherche multi-critères, liste, import **intégral** (création/MAJ), import **tarif** (MAJ prix), **export** (même format que l’import intégral).
>    Intégration avec **référentiel marques simplifié** : `materialType` (enum) + `famille` (select modifiable). Si marque inconnue → **création auto** avec normalisation.
>
> ---
>
> ### 1) ENTITIES (scoping strict tenantId/buId)
>
> **MaterialSupplier**
>
> ```json
> { "id":"uuid","tenantId":"string","buId":"string",
>   "name":"string","nameNorm":"string",
>   "vatNumber":"string","address":"string","email":"string","websiteUrl":"string",
>   "unitSystem":{"type":"enum","options":[["SI","SI"],["imperial","imperial"]]},
>   "currency":"string","createdAt":"datetime","updatedAt":"datetime" }
> ```
>
> Unicité `(tenantId,buId,nameNorm)` ; index idem. `nameNorm = trim→lower→sans accents→espaces compressés`.
>
> **MaterialSku**
>
> ```json
> { "id":"uuid","tenantId":"string","buId":"string",
>   "supplierName":"string","supplierNameNorm":"string",
>   "sku":"string",
>   "brand":"string","brandNorm":"string",
>   "label":"string","color":"string",
>   "supportType":{"type":"enum","options":[["F","Feuille"],["B","Bobine"],["P","Plaque"],["FF","Feuille sur fabrication"],["BF","Bobine sur fabrication"],["PF","Plaque sur fabrication"]]},
>   "grammage":"number","grammageUnit":{"type":"enum","options":[["g/m2","g/m2"]]},
>   "thickness":"number","thicknessUnit":{"type":"enum","options":[["micron","micron"],["mm","mm"],["point","point"]]},
>   "widthOrWeb":"number","heightOrRollLength":"number","dimUnit":{"type":"enum","options":[["mm","mm"],["cm","cm"],["m","m"]]},
>   "qtyPerPack":"integer",
>   "minOrder":"number","minOrderUnit":{"type":"enum","options":[["unite","unite"],["1000 unites","1000 unites"],["conditionnement","conditionnement"],["ml","ml"],["m2","m2"],["kg","kg"],["T","T"],["unite monetaire","unite monetaire"]]},
>   "basePrice":"number","priceUnit":{"type":"enum","options":[["par unite","par unite"],["pour 1000 unites","pour 1000 unites"],["par conditionnement","par conditionnement"],["ml","ml"],["m2","m2"],["kg","kg"],["T","T"]]},
>   "discountPct":"number",
>   "break1":"number","break1Type":{"type":"enum","options":[["si moins de X UM","si moins de X UM"],["si plus de X UM","si plus de X UM"],["si moins de X T","si moins de X T"],["si plus de X T","si plus de X T"]]},
>   "price1":"number","price1Type":{"type":"enum","options":[["supplément ou remise fixe","supplément ou remise fixe"],["variation %","variation %"]]},
>   "break2":"number","break2Type":{"type":"enum","options":[["si moins de X UM","si moins de X UM"],["si plus de X UM","si plus de X UM"],["si moins de X T","si moins de X T"],["si plus de X T","si plus de X T"]]},
>   "price2":"number","price2Type":{"type":"enum","options":[["supplément ou remise fixe","supplément ou remise fixe"],["variation %","variation %"]]},
>   "break3":"number","break3Type":{"type":"enum","options":[["si moins de X UM","si moins de X UM"],["si plus de X UM","si plus de X UM"],["si moins de X T","si moins de X T"],["si plus de X T","si plus de X T"]]},
>   "price3":"number","price3Type":{"type":"enum","options":[["supplément ou remise fixe","supplément ou remise fixe"],["variation %","variation %"]]},
>   "createdAt":"datetime","updatedAt":"datetime" }
> ```
>
> Unicité `(tenantId,buId,supplierNameNorm,sku)` ; index `(tenantId,buId,brandNorm)`, `(tenantId,buId,supportType)`, `(tenantId,buId,color)`.
>
> **MaterialBrand (référentiel simplifié, déjà présent)**
> Utiliser `materialType(enum)` + `famille(text)` (select modifiable) + `familleNorm`; créer à la volée si inconnue.
>
> ---
>
> ### 2) BACKEND FUNCTIONS (sécurisées, RBAC)
>
> Scoping **serveur** obligatoire `(tenantId==ctx.tenantId && buId==ctx.currentBuId)`.
>
> **Suppliers**
>
> * `Suppliers.List({search?,page?,pageSize?})`
> * `Suppliers.Create({name,vatNumber,address,email,websiteUrl,unitSystem,currency})` *(normaliser nameNorm; 409 si doublon)*
> * `Suppliers.Update({id,patch})` *(renormaliser si name change)*
> * `Suppliers.Delete({id})` *(409 si des SKUs référencent supplierNameNorm)*
> * `Suppliers.Suggest({q?,limit?=20})` *(noms distincts de la BU)*
> * `Suppliers.QualificationStatus({id})` → **vert** si `vatNumber,email,websiteUrl,unitSystem,currency` présents ; **orange** sinon ; **rouge** si fiche quasi vide.
>
> **SKUs**
>
> * `Skus.List({search?,supplier?,materialType?,famille?,brand?,supportType?,color?,grammageMin?,grammageMax?,page?,pageSize?,sort?})`
>
>   * `supplier` via `supplierNameNorm`; `materialType/famille/brand` via `MaterialBrand` (match `brandNorm` + `familleNorm`).
> * `Skus.Create(data)` / `Skus.Update({id,patch})`
>
>   * Normaliser `supplierNameNorm` et `brandNorm`.
>   * **Auto-créer** `MaterialSupplier` minimal si fournisseur inconnu.
>   * **Auto-créer** `MaterialBrand` si marque inconnue ; si payload inclut `brand.materialType`/`brand.famille`, les poser.
> * `Skus.Delete({id})`
>
> **Import/Export**
>
> * `Skus.Export({format:"csv"|"json"})` → **identique à l’import intégral** (cf. §4).
> * `Skus.ImportFull({format,file,mode:"upsert"|"insertOnly"|"replace",dryRun?:bool})`
>
>   * Upsert par `(supplierNameNorm,sku)` ; normaliser noms ; créer fournisseurs/brands si manquants ; accepter champs **qualification marque** optionnels et les refléter dans le référentiel.
>   * Rapport **JSON + CSV** (erreurs contextuelles).
> * `Skus.ImportPrices({format,file,mode:"upsert",dryRun?:bool})`
>
>   * Appariement par `(nomFournisseur,SKU)` ; met à jour **uniquement** les champs tarifaires.
> * `Skus.ExportTemplate()` → modèle CSV d’import intégral.
>
> **RBAC**
>
> * Lecture : `tenantAdmin`, `buAdmin`, `buPaperAdmin`, `paperAdmin`, `viewer`.
> * Écriture (CRUD, import/export) : `tenantAdmin`, `buAdmin`, `buPaperAdmin` ; `paperAdmin` = **update limité** (pas de delete/import replace).
>
> **Audit**
>
> * `suppliers.create/update/delete`, `skus.create/update/delete`, `skus.import.full.{dryRun,commit}`, `skus.import.prices.{dryRun,commit}`, `skus.export`.
>
> ---
>
> ### 3) UI / UX (BU)
>
> **Fournisseurs** — `pages/bu/materials/Suppliers.jsx`
>
> * Table : `name`, `vatNumber`, `email`, `websiteUrl`, `unitSystem`, `currency`, **badge statut** (vert/orange/rouge) ; clic fournisseur → `SupplierEditModal.jsx` (création/édition).
> * Recherche + tri sur nom ; i18n + validations (email/URL/ISO 4217).
>
> **Catalogue SKU** — `pages/bu/materials/Skus.jsx`
>
> * **Filtres** :
>
>   * **Fournisseur** (sélecteur **créable** via `Suppliers.Suggest()` ; création à la volée ouvre `SupplierEditModal`).
>   * **Type de matière** (enum), **Famille** (select modifiable depuis valeurs distinctes de la BU), **Marque** (suggest créable), **Type de support** (chips), **Couleur**, **Grammage** (min/max).
> * **Liste** (table virtualisée) :
>
>   * Fournisseur avec **code couleur** (qualif), cliquable → modal fournisseur.
>   * Marque avec **code couleur** : **vert** si `materialType != 0` **ET** `famille` non vide **ET** ≥1 procédé d’impression coché ; **rouge** sinon.
>   * Colonnes : Support (F/B/P/FF/BF/PF), Couleur, **Format** (HxL ou Laize), Conditionnement (`qtyPerPack`), **Mini de commande**, **Tarif base**.
>   * Actions : Éditer / Dupliquer / Supprimer (selon droits).
> * **Drawer** `SkuEditDrawer.jsx` : tous champs de référencement/qualif/tarifs avec unités (selects).
> * **Panneau Import/Export** : import **intégral** et **tarif** (avec **dryRun** + rendu erreurs + commit), export et template.
>
> **Normalisation UI**
>
> * Normaliser `supplierName`/`brand` au blur (affiché “tel que saisi”, stocké `*Norm`). Tooltips d’aide (unités, règles de prix/borne).
>
> ---
>
> ### 4) Formats d’IMPORT/EXPORT
>
> **Import intégral (CSV/JSON)** — *tous les champs SKU* + **qualif marque (optionnel)**
>
> * Référencement : `nomFournisseur` (créable, normalisé), `SKU` (clé avec fournisseur).
> * SKU : `supportType`, `brand`, `label`, `color`, `grammage`,`grammageUnit`,`thickness`,`thicknessUnit`,`widthOrWeb`,`heightOrRollLength`,`dimUnit`,`qtyPerPack`.
> * Tarifs : `minOrder`,`minOrderUnit`,`basePrice`,`priceUnit`,`discountPct`, `(break1,break1Type,price1,price1Type)`, `(break2,break2Type,price2,price2Type)`, `(break3,break3Type,price3,price3Type)`.
> * **Qualif marque (optionnel)** :
>
>   * `brand.materialType` (enum/texte tolérant), `brand.famille` (texte),
>   * `brand.fire.M1` (bool),
>   * `brand.digitalPress.Canon|HP|Kodak|KonicaMinolta|Ricoh|Xeikon|Xerox` (bool), `brand.digitalPress.Others` (liste `;`),
>   * `brand.process.Numerique|Offset|OffsetUV|Coldset|Heliogravure|Serigraphie|Flexographie` (bool),
>   * `brand.eco.PEFC100|PEFCRecycle|PEFC70|FSC100|FSCRecycle|FSCMix|Recycle|BlueAngel|Ecolabel|NordicSwan|APUR|PaperByNature` (bool).
> * Règles : upsert `(supplierNameNorm,sku)` ; auto-création fournisseur/marque ; mapping bools `1/0,true/false,y/n,yes/no`; rapport **JSON+CSV** en **dryRun** puis **commit**.
>
> **Import tarifs**
>
> * Clé : `nomFournisseur`,`SKU` ; met à jour **uniquement** champs tarifs.
>
> **Export**
>
> * Identique à l’import intégral.
> * `Skus.ExportTemplate()` fournit le modèle.
>
> ---
>
> ### 5) i18n (fr/en)
>
> Namespaces `suppliers.*`, `skus.*`, `importExport.*` (labels, validations, toasts, erreurs : `unknownMaterialType`, `invalidUnit`, `duplicateSupplier`, `skuKeyConflict`, `missingKey`).
>
> ---
>
> ### 6) Audit & Metrics
>
> * Audit : `suppliers.create/update/delete`, `skus.create/update/delete`, `skus.import.full.{dryRun,commit}`, `skus.import.prices.{dryRun,commit}`, `skus.export`.
> * (Optionnel) Metrics BU : #fournisseurs “verts”, #SKU, % marques “vertes”.
>
> ---
>
> ### 7) RBAC
>
> * Lecture : `tenantAdmin`, `buAdmin`, `buPaperAdmin`, `paperAdmin`, `viewer`.
> * Écriture : `tenantAdmin`, `buAdmin`, `buPaperAdmin`; `paperAdmin` = **update limité** (pas de delete/import replace).
> * UI : **masquer** (pas disable) les actions non autorisées.
>
> ---
>
> ### 8) Tests manuels (à ajouter au guide)
>
> 1. Fournisseur : création → statut rouge → complétion → vert ; suppression refusée si SKU liés.
> 2. SKU : création (nouveau fournisseur créé à la volée), normalisation noms ; édition & duplication.
> 3. Filtres : fournisseur, materialType, famille, marque, supportType, couleur, grammage (range).
> 4. Import intégral : **dryRun** (erreurs lisibles) → **commit** (auto-créations OK).
> 5. Import tarifs : MAJ des prix sans toucher au reste.
> 6. Export : réimporter dans une autre BU → mêmes données (ids différents).
> 7. RBAC : `paperAdmin` update limité ; `viewer` RO.
> 8. Audit : toutes les actions visibles avec liens contextuels.
>
> ---
>
> ### 9) Critères d’acceptation
>
> * Scoping serveur `(tenantId,buId)` sur toutes les Functions.
> * Normalisation/Unicité fournisseurs & SKUs respectées.
> * Liste + modal fournisseurs OK ; badge qualif exact.
> * Catalogue SKU : filtres/tri performants (table virtualisée).
> * Import/Export opérationnels (**dryRun** + rapports).
> * RBAC, i18n, audit conformes.

> Merci d’implémenter et de fournir : endpoints créés, captures UI (liste fournisseurs, liste SKU, modales, import dryRun), et un **export d’exemple**.
