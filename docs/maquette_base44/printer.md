Oui. Le modèle machine doit être assez riche pour décrire la **capacité industrielle**, les **contraintes techniques** et le **modèle économique** d’un poste de production, sans enfermer toutes les machines dans un schéma identique.

Je recommande un modèle en trois niveaux :

1. **Machine / poste de production** : identité et caractéristiques générales
2. **Capacités et contraintes** : ce que la machine peut réellement produire
3. **Barèmes de production** : temps, coûts, gâches et paliers de quantité

# PRD — Modèle de description des machines imprimeur

## 1. Définition

Une machine représente un **poste de production** disponible dans un `PrinterEnvironment`.

Le terme « machine » recouvre aussi bien :

* une presse offset ;
* une presse numérique ;
* une imprimante grand format ;
* une ligne de finition ;
* une machine de découpe ;
* une chaîne de reliure ;
* un poste manuel ;
* un poste de conditionnement ;
* un équipement de contrôle ou de préparation.

Une machine appartient à un seul environnement imprimeur et ne peut pas être utilisée par un autre imprimeur sans duplication explicite.

---

# 2. Objectifs fonctionnels

Le modèle machine doit permettre de :

* décrire précisément le parc industriel d’un imprimeur ;
* déterminer si une machine est compatible avec un projet ;
* calculer un temps de production ;
* calculer un coût de production ;
* gérer les temps fixes et variables ;
* gérer les pertes et gâches ;
* sélectionner automatiquement la machine la plus pertinente ;
* comparer plusieurs machines compatibles ;
* tester et valider les résultats de pricing ;
* importer et exporter la configuration ;
* versionner les réglages ;
* déléguer le finetuning à un `printerAdmin`.

---

# 3. Structure principale de l’entité Machine

```json
{
  "id": "uuid",
  "tenantId": "string",
  "buId": "string",
  "printerEnvironmentId": "uuid",

  "name": "string",
  "internalCode": "string",
  "manufacturer": "string",
  "model": "string",
  "description": "string",

  "workstationType": "enum",
  "printingProcess": "enum|null",

  "active": "boolean",
  "availableForPricing": "boolean",
  "priority": "integer",

  "unitSystem": "SI|imperial",
  "currency": "ISO 4217",

  "capabilities": {},
  "productionParameters": {},
  "costParameters": {},
  "wasteParameters": {},
  "constraints": {},
  "rateSchedules": [],

  "createdAt": "datetime",
  "updatedAt": "datetime",
  "createdBy": "string",
  "updatedBy": "string"
}
```

---

# 4. Identification de la machine

## Champs

### Nom

```json
"name": "Heidelberg Speedmaster XL 106"
```

Nom fonctionnel affiché dans les interfaces et les résultats de calcul.

Champ obligatoire.

### Code interne

```json
"internalCode": "OFFSET-01"
```

Identifiant interne utilisé par l’imprimeur.

Le code doit être unique dans un même `PrinterEnvironment`.

### Fabricant

Exemples :

* Heidelberg ;
* Komori ;
* Canon ;
* HP ;
* Xerox ;
* Konica Minolta ;
* Durst ;
* Bobst ;
* Müller Martini.

### Modèle

Exemples :

* Speedmaster XL 106 ;
* Indigo 15K ;
* VarioPrint iX3200 ;
* AccurioPress C14000.

### Description

Texte libre permettant de préciser :

* les options particulières ;
* l’année de mise en service ;
* les modifications apportées ;
* les restrictions connues ;
* le rôle de la machine dans l’atelier.

---

# 5. Type de poste

Le champ `workstationType` définit la fonction principale de la machine.

## Types recommandés

```json
[
  "prepress",
  "digital_sheet_printing",
  "digital_web_printing",
  "offset_sheet_printing",
  "offset_web_printing",
  "coldset_printing",
  "heatset_printing",
  "large_format_printing",
  "screen_printing",
  "flexography",
  "gravure_printing",
  "cutting",
  "creasing",
  "folding",
  "lamination",
  "varnishing",
  "die_cutting",
  "binding",
  "stitching",
  "perfect_binding",
  "case_binding",
  "drilling",
  "perforation",
  "gluing",
  "packaging",
  "manual_work",
  "quality_control",
  "other"
]
```

L’interface doit afficher des libellés traduits, mais stocker une valeur technique stable.

---

# 6. Procédé d’impression

Le champ `printingProcess` est obligatoire pour les postes d’impression et vide pour les postes de finition.

```json
[
  "digital",
  "offset",
  "offset_uv",
  "coldset",
  "heatset",
  "gravure",
  "screen_printing",
  "flexography",
  "large_format_digital"
]
```

Ce champ doit être compatible avec les procédés autorisés sur la marque de matière sélectionnée.

Exemple :

Une marque de papier déclarée compatible uniquement avec `digital` et `offset` ne doit pas pouvoir être utilisée sur une machine `flexography`.

---

# 7. Statut et disponibilité

## Active

```json
"active": true
```

Indique que la machine est actuellement présente dans le parc.

Une machine inactive reste visible dans l’historique, mais ne peut pas être sélectionnée pour un nouveau calcul.

## Disponible pour le pricing

```json
"availableForPricing": true
```

Permet de préparer une machine sans qu’elle soit immédiatement prise en compte dans les calculs.

Cas d’usage :

* machine en cours de qualification ;
* nouvelle machine pas encore validée ;
* machine temporairement indisponible ;
* machine conservée uniquement pour l’historique.

## Priorité

```json
"priority": 10
```

Permet de départager plusieurs machines compatibles.

La priorité ne doit intervenir qu’après les contraintes techniques et économiques.

---

# 8. Capacités dimensionnelles

## Structure

```json
"capabilities": {
  "minWidth": 100,
  "maxWidth": 740,
  "minHeight": 150,
  "maxHeight": 1060,
  "dimensionUnit": "mm",

  "minWebWidth": null,
  "maxWebWidth": null,

  "maxPrintedWidth": 720,
  "maxPrintedHeight": 1040,

  "maxThickness": 1.2,
  "thicknessUnit": "mm",

  "minGrammage": 60,
  "maxGrammage": 600,
  "grammageUnit": "g/m2"
}
```

## Dimensions d’entrée

* largeur minimale ;
* largeur maximale ;
* hauteur minimale ;
* hauteur maximale.

## Dimensions imprimables

Les dimensions imprimables peuvent être inférieures au format physique accepté.

Exemple :

* format feuille maximum : 740 × 1060 mm ;
* surface imprimable : 720 × 1040 mm.

## Machines bobine

Pour les machines bobine :

* laize minimale ;
* laize maximale ;
* diamètre maximum de bobine ;
* poids maximum de bobine ;
* diamètre du mandrin ;
* longueur maximale de bobine si nécessaire.

```json
"webCapabilities": {
  "minWebWidth": 300,
  "maxWebWidth": 1300,
  "maxRollDiameter": 1200,
  "maxRollWeightKg": 1500,
  "coreDiametersMm": [76, 152]
}
```

---

# 9. Supports compatibles

## Types de supports

```json
"supportedMaterialTypes": [1, 2, 3, 9, 10]
```

Les valeurs reprennent l’énumération du référentiel matière BU.

## Familles compatibles

```json
"supportedFamilies": [
  "Couché brillant",
  "Couché mat",
  "Offset blanc"
]
```

La famille reste une valeur textuelle normalisée.

## Marques autorisées ou interdites

```json
"brandRules": {
  "allowedBrandIds": [],
  "excludedBrandIds": []
}
```

Une liste vide d’autorisations signifie que toutes les marques techniquement compatibles peuvent être utilisées.

## Supports en feuille, bobine ou plaque

```json
"supportedSupportTypes": ["F", "FF"]
```

Valeurs possibles :

* `F` : feuille stock ;
* `B` : bobine stock ;
* `P` : plaque stock ;
* `FF` : feuille sur fabrication ;
* `BF` : bobine sur fabrication ;
* `PF` : plaque sur fabrication.

---

# 10. Capacités d’impression

## Couleurs

```json
"printCapabilities": {
  "numberOfPrintingUnits": 8,
  "supportsCMYK": true,
  "supportsSpotColors": true,
  "maxSpotColors": 4,
  "supportsWhite": false,
  "supportsVarnish": true,
  "supportsPrimer": false
}
```

## Recto-verso

```json
"duplexCapabilities": {
  "simplex": true,
  "duplex": true,
  "perfectingInOnePass": true
}
```

## Résolution

```json
"resolutionDpi": {
  "horizontal": 2400,
  "vertical": 2400
}
```

## Couverture d’encre

```json
"inkCoverageConstraints": {
  "maxCoveragePct": 320,
  "defaultCoveragePct": 20
}
```

## Technologies particulières

Exemples :

* impression UV ;
* toner sec ;
* toner liquide ;
* jet d’encre aqueux ;
* jet d’encre UV ;
* latex ;
* sublimation ;
* blanc couvrant ;
* vernis en ligne ;
* dorure numérique.

---

# 11. Configuration et imposition

## Nombre de poses

Le nombre de poses peut être calculé automatiquement à partir :

* du format du produit ;
* du format machine ;
* des marges techniques ;
* des fonds perdus ;
* des pinces ;
* des espaces entre poses ;
* du sens fibre ;
* du sens d’impression.

## Paramètres

```json
"layoutParameters": {
  "gripperMargin": 12,
  "tailMargin": 8,
  "sideMarginLeft": 5,
  "sideMarginRight": 5,
  "gapBetweenItemsX": 4,
  "gapBetweenItemsY": 4,
  "defaultBleed": 3,
  "allowRotation": true,
  "allowMixedOrientation": false,
  "respectGrainDirection": true,
  "dimensionUnit": "mm"
}
```

## Contraintes d’imposition

```json
"layoutConstraints": {
  "maxPoses": 64,
  "evenNumberOfPosesRequired": false,
  "sameOrientationRequired": false,
  "allowWorkAndTurn": true,
  "allowWorkAndTumble": true
}
```

---

# 12. Paramètres de production

Les paramètres de production sont séparés en temps fixes et temps variables.

## Temps fixes

```json
"productionParameters": {
  "setupTimeMinutes": 30,
  "plateChangeTimeMinutes": 8,
  "colorChangeTimeMinutes": 5,
  "paperChangeTimeMinutes": 10,
  "cleaningTimeMinutes": 15,
  "shutdownTimeMinutes": 5
}
```

Exemples de temps fixes :

* préparation machine ;
* chargement du papier ;
* calage ;
* changement de plaques ;
* changement de couleur ;
* nettoyage ;
* contrôle initial ;
* démontage.

## Vitesse de production

```json
"speedParameters": {
  "defaultSpeedPerHour": 12000,
  "minSpeedPerHour": 5000,
  "maxSpeedPerHour": 18000,
  "speedUnit": "sheets_per_hour"
}
```

Unités possibles :

```json
[
  "sheets_per_hour",
  "meters_per_hour",
  "square_meters_per_hour",
  "items_per_hour",
  "cycles_per_hour"
]
```

## Vitesse variable

La vitesse peut dépendre :

* du grammage ;
* du format ;
* du nombre de couleurs ;
* de la couverture d’encre ;
* du recto-verso ;
* du type de matière ;
* de la quantité.

Exemple :

```json
"speedRules": [
  {
    "condition": {
      "field": "grammage",
      "operator": ">",
      "value": 300
    },
    "speedPerHour": 9000
  },
  {
    "condition": {
      "field": "duplex",
      "operator": "=",
      "value": true
    },
    "speedMultiplier": 0.8
  }
]
```

---

# 13. Barèmes de production

Une machine peut disposer de plusieurs barèmes.

Un barème permet de faire varier le coût ou la vitesse en fonction d’une condition.

## Structure

```json
"rateSchedules": [
  {
    "id": "uuid",
    "name": "Tarif standard",
    "active": true,
    "priority": 1,
    "conditions": {
      "quantityMin": 0,
      "quantityMax": 5000,
      "grammageMin": 60,
      "grammageMax": 350,
      "supportTypes": ["F"],
      "colorMode": "CMYK"
    },
    "setupCost": 150,
    "hourlyCost": 220,
    "unitCost": 0,
    "speedPerHour": 12000
  }
]
```

## Conditions possibles

* quantité minimale et maximale ;
* format minimal et maximal ;
* grammage ;
* épaisseur ;
* type de support ;
* famille matière ;
* procédé ;
* nombre de couleurs ;
* recto-verso ;
* type de produit ;
* niveau de finition.

## Priorité des barèmes

Si plusieurs barèmes sont compatibles :

1. sélectionner le barème le plus spécifique ;
2. appliquer la priorité configurée ;
3. à priorité égale, sélectionner le barème le plus récent ;
4. journaliser le barème retenu dans le résultat du calcul.

---

# 14. Modèle économique

## Coût horaire

```json
"costParameters": {
  "hourlyCost": 220,
  "currency": "EUR"
}
```

Le coût horaire peut intégrer :

* amortissement ;
* énergie ;
* maintenance ;
* main-d’œuvre ;
* occupation atelier ;
* consommables généraux.

## Coût fixe de calage

```json
"setupCost": 150
```

## Coût unitaire

```json
"unitCost": 0.002
```

Utilisé lorsque la machine comporte une composante de coût au clic, à la feuille, au mètre ou à la pièce.

## Coûts par couleur

```json
"colorCosts": {
  "processColorSetup": 15,
  "spotColorSetup": 35,
  "whiteInkSetup": 50,
  "varnishSetup": 40
}
```

## Coût minimum

```json
"minimumJobCost": 100
```

Le coût calculé ne peut pas être inférieur à ce montant.

---

# 15. Gâches et pertes

## Gâche de calage

```json
"wasteParameters": {
  "setupWasteFixed": 250,
  "setupWastePerColor": 50
}
```

## Gâche de roulage

```json
"runningWaste": {
  "fixedQuantity": 0,
  "percentage": 2.5
}
```

## Gâche par palier

```json
"wasteRules": [
  {
    "quantityMin": 0,
    "quantityMax": 1000,
    "wastePct": 5
  },
  {
    "quantityMin": 1001,
    "quantityMax": 10000,
    "wastePct": 3
  },
  {
    "quantityMin": 10001,
    "quantityMax": null,
    "wastePct": 1.5
  }
]
```

## Gâche de reprise

Une reprise peut être déclenchée par :

* changement de bobine ;
* changement de palette ;
* changement de lot ;
* interruption de production ;
* fractionnement de commande.

---

# 16. Main-d’œuvre

```json
"laborParameters": {
  "operatorsRequired": 2,
  "operatorHourlyCost": 35,
  "assistantOperatorsRequired": 1,
  "assistantHourlyCost": 25,
  "includedInMachineHourlyCost": true
}
```

Le système doit éviter le double comptage si la main-d’œuvre est déjà incluse dans le coût horaire machine.

---

# 17. Consommables

```json
"consumables": [
  {
    "name": "Plaque offset",
    "calculationMode": "per_color",
    "unitCost": 12,
    "quantity": 1
  },
  {
    "name": "Encre",
    "calculationMode": "per_square_meter",
    "unitCost": 0.08
  }
]
```

Modes de calcul possibles :

* fixe par projet ;
* par couleur ;
* par feuille ;
* par pose ;
* par unité produite ;
* par mètre linéaire ;
* par mètre carré ;
* par kilogramme ;
* par heure ;
* par cycle machine.

---

# 18. Prestations intégrées

Une machine peut produire plusieurs opérations dans un même passage.

Exemples :

* impression + vernis ;
* impression + séchage UV ;
* impression + découpe ;
* impression + rainage ;
* impression + pelliculage ;
* pliage + collage ;
* assemblage + agrafage.

```json
"inlineOperations": [
  "printing",
  "varnishing",
  "uv_drying",
  "creasing"
]
```

Ces opérations ne doivent pas générer automatiquement un poste séparé si elles sont déclarées comme intégrées au passage machine.

---

# 19. Contraintes techniques

```json
"constraints": {
  "minQuantity": 1,
  "maxQuantity": null,
  "minRunLength": null,
  "maxRunLength": null,

  "requiresCoatedMaterial": false,
  "requiresCoronaTreatment": false,
  "requiresDryingTime": false,

  "allowedColors": ["CMYK", "CMYK+White"],
  "excludedFinishes": [],
  "requiredCertifications": []
}
```

## Conditions bloquantes

Une condition bloquante rend la machine incompatible.

Exemples :

* format hors capacité ;
* grammage trop élevé ;
* support non compatible ;
* procédé non autorisé par la marque ;
* nombre de couleurs supérieur à la capacité ;
* finition demandée indisponible ;
* quantité inférieure au minimum ;
* quantité supérieure à la capacité ;
* machine inactive.

## Conditions non bloquantes

Une condition non bloquante génère une alerte.

Exemples :

* grammage proche de la limite ;
* vitesse estimée réduite ;
* marque non complètement qualifiée ;
* coût horaire provisoire ;
* barème non validé.

---

# 20. Sélection automatique de la machine

La sélection doit s’effectuer dans cet ordre :

1. filtrer les machines actives ;
2. filtrer celles disponibles pour le pricing ;
3. vérifier le procédé demandé ;
4. vérifier le support et la marque ;
5. vérifier les formats et grammages ;
6. vérifier les couleurs et finitions ;
7. déterminer le nombre de poses ;
8. calculer les gâches ;
9. calculer le temps ;
10. calculer le coût ;
11. appliquer les minimums ;
12. classer les machines compatibles.

## Critères de classement

```json
"selectionStrategy": [
  "lowest_total_cost",
  "shortest_lead_time",
  "highest_priority"
]
```

Le résultat doit expliquer la décision :

```json
{
  "selectedMachine": "Heidelberg XL 106",
  "selectedRateSchedule": "Tarif standard",
  "totalCost": 842.5,
  "productionTimeMinutes": 165,
  "poses": 8,
  "wasteQuantity": 420,
  "rejectedMachines": [
    {
      "machine": "Indigo 15K",
      "reason": "quantity_above_recommended_limit"
    }
  ]
}
```

---

# 21. Qualification d’une machine

Chaque machine possède un score de complétude.

## Sections évaluées

* identité ;
* formats ;
* matières ;
* capacités d’impression ;
* vitesse ;
* coûts ;
* gâches ;
* barèmes ;
* contraintes ;
* tests.

## Exemple

```json
"qualification": {
  "completionPct": 82,
  "status": "partially_qualified",
  "missingFields": [
    "runningWaste.percentage",
    "maxThickness",
    "minimumJobCost"
  ],
  "warnings": [
    "No validated test scenario"
  ]
}
```

## États

* `not_qualified` : informations insuffisantes ;
* `partially_qualified` : exploitable avec alertes ;
* `fully_qualified` : données complètes ;
* `validated` : données complètes et tests réussis.

---

# 22. Wizard machine

Le wizard de création machine doit proposer une saisie progressive.

## Étape 1 — Type de machine

* nom ;
* type de poste ;
* procédé ;
* fabricant ;
* modèle.

Le choix du type adapte automatiquement les étapes suivantes.

## Étape 2 — Formats et matières

* feuille, bobine ou plaque ;
* formats minimum et maximum ;
* grammages ;
* épaisseurs ;
* types de matière ;
* familles ;
* marques exclues.

## Étape 3 — Capacités

Pour une presse :

* couleurs ;
* recto-verso ;
* résolution ;
* options en ligne.

Pour une finition :

* types d’opérations ;
* dimensions acceptées ;
* nombre de plis ;
* types de reliure ;
* épaisseur maximum.

## Étape 4 — Production

* vitesse ;
* temps de calage ;
* changements ;
* nettoyage ;
* nombre d’opérateurs.

## Étape 5 — Coûts

* coût horaire ;
* coût de calage ;
* coût unitaire ;
* consommables ;
* minimum de facturation.

## Étape 6 — Gâches

* gâche fixe ;
* gâche par couleur ;
* pourcentage de roulage ;
* règles par quantité.

## Étape 7 — Barèmes

* barème standard ;
* paliers de quantité ;
* variations de vitesse ;
* variations de coûts.

## Étape 8 — Test

Créer et exécuter automatiquement un scénario représentatif.

À la fin :

* afficher le coût calculé ;
* afficher les alertes ;
* afficher le score de qualification ;
* permettre d’enregistrer la machine en brouillon ou de la rendre disponible pour le pricing.

---

# 23. UX de la liste des machines

## Colonnes

* statut ;
* nom ;
* type ;
* procédé ;
* format maximum ;
* grammage ;
* vitesse ;
* coût horaire ;
* score de qualification ;
* disponible pour pricing ;
* actions.

## Codes couleur

* vert : machine validée ;
* orange : partiellement qualifiée ;
* rouge : données insuffisantes ;
* gris : inactive.

## Filtres

* type de poste ;
* procédé ;
* actif/inactif ;
* disponible pricing ;
* qualification ;
* support compatible ;
* marque compatible.

## Actions

* éditer ;
* dupliquer ;
* tester ;
* importer ;
* exporter ;
* désactiver ;
* supprimer ;
* créer un nouveau draft.

---

# 24. Import et export

## Import intégral

L’import doit pouvoir créer ou mettre à jour une machine à partir d’un fichier JSON ou CSV.

Clé d’appariement recommandée :

```text
printerEnvironmentId + internalCode
```

## Modes

* `dryRun` ;
* `insertOnly` ;
* `upsert` ;
* `replace`.

## Export

L’export doit reprendre :

* identité ;
* capacités ;
* paramètres de production ;
* coûts ;
* gâches ;
* consommables ;
* barèmes ;
* contraintes ;
* métadonnées de version.

L’export permet :

* duplication dans un autre environnement ;
* régionalisation ;
* sauvegarde ;
* création de templates par type de machine.

---

# 25. Versioning et audit

Chaque modification sensible doit être auditée :

* changement de vitesse ;
* changement de coût horaire ;
* modification des gâches ;
* modification des formats ;
* ajout ou suppression d’un barème ;
* activation ou désactivation ;
* publication.

Le journal doit stocker :

```json
{
  "machineId": "uuid",
  "action": "machine.cost.updated",
  "before": {},
  "after": {},
  "actorId": "uuid",
  "actorRole": "printerAdmin",
  "timestamp": "datetime"
}
```

Une machine en version Production ne doit pas être modifiée directement.

Toute modification crée une nouvelle version Draft.

---

# 26. Permissions

## tenantAdmin

Accès complet.

## buAdmin

Création, édition, suppression, tests et publication.

## buPrinterAdmin

Création, édition, duplication, import, export et invitation de `printerAdmin`.

## printerAdmin

Peut :

* modifier les caractéristiques ;
* modifier les capacités ;
* modifier les coûts ;
* modifier les gâches ;
* modifier les barèmes ;
* exécuter les tests.

Ne peut pas :

* publier ;
* supprimer l’environnement ;
* accéder à l’onglet administrateur ;
* gérer les utilisateurs ;
* modifier le tenant ou la BU ;
* contourner les validations.

---

# 27. Critères d’acceptation

* Une machine est toujours rattachée à un `PrinterEnvironment`.
* Les données sont scoppées par `tenantId`, `buId` et `printerEnvironmentId`.
* Le formulaire s’adapte au type de poste.
* Une machine incomplète peut être enregistrée en brouillon.
* Une machine incompatible est exclue du calcul avec une raison explicite.
* Le calcul restitue la machine et le barème retenus.
* Les coûts fixes et variables sont distingués.
* Les gâches sont intégrées dans les besoins matière.
* Les procédés de la machine sont contrôlés par rapport au référentiel matière.
* La publication exige au moins un scénario de test validé.
* Toutes les modifications sensibles sont auditables.
* Le `printerAdmin` ne voit jamais l’onglet administrateur.

Le point clé est de ne pas créer une seule fiche monolithique contenant des centaines de champs toujours visibles. Base44 doit construire un **formulaire dynamique piloté par `workstationType`** : une presse offset, un massicot et une ligne de reliure utilisent le même socle, mais présentent des capacités et des barèmes adaptés.
