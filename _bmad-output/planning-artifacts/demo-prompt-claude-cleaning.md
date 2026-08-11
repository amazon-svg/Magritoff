# Prompt Claude — Nettoyage fichier brut client → format Clariprint ApiAppelOffre

> **Usage** : prompt copy-paste prêt à coller dans Claude (chat ou API).
> Destiné à la démo Magrit Core du 15/06.
> **Version** : v2 — calibré sur la doc réelle Clariprint
> (https://trac.clariprint.com/wiki/ApiAppelOffre).
> **Découverte clé v1 → v2** : Clariprint attend un **CSV `;`** (pas du JSON), avec
> vocabulaire FR (`type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso;…`).
> La chaîne complète : fichier brut → JSON intermédiaire validé (UI Magrit Core
> avec validation tricolore) → CSV Clariprint pour l'API.

---

## Mode d'emploi (séquence démo)

1. Coller le **bloc PROMPT** ci-dessous dans une nouvelle conversation Claude
   (Opus 4.x ou Sonnet 4.5+).
2. Coller à la suite, dans le même message, le contenu du fichier brut client
   (CSV / tableau Markdown / Excel attaché).
3. Claude répond avec :
   - **JSON intermédiaire** structuré avec confidences `green/orange/red` par champ
     (objet métier interne, sert à l'UI Magrit Core pour validation tricolore).
   - **CSV Clariprint** final prêt à coller dans la requête `ApiAppelOffre`
     (action=creation).
4. Le CSV est envoyé via POST à `mon_domaine/optimprokect/csv.wcl` avec
   `key=<clé API>` + `action=creation` + `sheets[]=A` + `columns[A]=…` +
   `rows[A!N]=…`.
5. Réponse asynchrone : `SESSION;<session_key>` + un projet par ligne en
   statut `CREATE`. Polling `action=status` jusqu'à `OK` → prix par projet.

---

## Bloc PROMPT (copy-paste)

```
Tu es un agent de transformation de fichiers print. Tu reçois un tableau brut envoyé par un
client (Excel, CSV ou tableau Markdown) qui liste des commandes d'impression hétérogènes.
Ton travail est double :

1. Produire un JSON intermédiaire (avec confidences green/orange/red par champ) qui sert
   à Magrit Core pour l'affichage tricolore et la validation humaine AVANT envoi.
2. Produire le CSV Clariprint au format ApiAppelOffre (separator `;`) prêt à envoyer
   à l'API Solver.

Tu produis les DEUX livrables dans la même réponse, dans cet ordre.

# Référentiel Clariprint (cible API)

Endpoint Clariprint ApiAppelOffre attend un payload de type :
  rows[A!<n>] = type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso;<binding>;<pages>;...

Les colonnes (séparateur `;`) sont déclarées dans `columns[A]`. Pour la démo, on utilise
ces 9 colonnes de base :

  type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso

Pour les produits brochés (brochure / cahier), on étend à :

  type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso;binding;pages

## Vocabulaire Clariprint (énumérations réelles à respecter)

### `type` — types de produits couverts par ApiAppelOffre V1

| Valeur Clariprint | Déclencheurs FR typiques |
|---|---|
| `feuillet` | "feuillet", "flyer", "tract", "carte de visite", "carte commerciale", "carte de correspondance" |
| `leaflet` | (synonyme anglais de feuillet, à éviter en FR) |
| `dépliant` | "dépliant", "leaflet plié", "3 volets", "2 volets", "carte pliée" |
| `folded` | (synonyme anglais de dépliant) |
| `brochure` | "brochure" + pages > 1, "catalogue", "livret", "magazine" |
| `book` | (synonyme anglais de brochure) |
| `cahier` | "cahier", "carnet" |
| `chemise` / `folder` | "chemise", "pochette" |
| `cover` / `couverture` | "couverture brochure" |
| `encart` / `insert` | "encart", "insertion" |
| `folded insert` | "encart plié" |

### Types HORS scope ApiAppelOffre V1 (signaler en `red` + warning)

Les produits suivants ne sont PAS pris en charge par cette API actuelle. Les marquer
`type: "OUT_OF_SCOPE"`, confidence `red`, et lister précisément dans `warnings` :
- Affiches / posters
- Kakémonos / roll-ups
- Banderoles / bâches grand format
- Étiquettes adhésives / stickers
- Enveloppes (DL, C5, C4…)

### Dimensions (`hauteur` / `largeur`)

- Format réel API : **chiffres en CENTIMÈTRES, virgule décimale française** (ex :
  `29,7` pour A4 hauteur).
- Conversion :
  - Si format ISO connu, valeurs canoniques :
    - A6 = 14,8 × 10,5
    - A5 = 21 × 14,8
    - A4 = 29,7 × 21
    - A3 = 42 × 29,7
    - A2 = 59,4 × 42
    - A1 = 84,1 × 59,4
    - A0 = 118,9 × 84,1
  - Si source en mm : diviser par 10 (ex : `85 × 55 mm` → `8,5 × 5,5`).
  - Si source ambiguë (valeurs entre 50 et 999 sans unité) : marquer `orange`.

### `qt` — quantité

Entier sans séparateur de milliers. Si manquant → `red`.

### `Qualité` — qualité papier

String libre, avec majuscule initiale. Exemples valides (vus dans la doc) :
- `Couché demi-mat`
- `Couché brillant`
- `Couché mat`
- `Offset`
- `Vergé`

Si la source dit "couche brillant" (sans accent) → corriger en `Couché brillant`.

### `grammage` — entier

Sans unité (juste le nombre). Ex : `115`, `135`, `170`, `250`, `350`.
Si source dit "350g" → extraire `350`.
Si manquant → `orange` (et proposer une valeur cohérente par défaut selon le type).

### `recto` / `verso` — encres

Codes encres réels de l'API :
- `Q` = quadrichromie (CMJN, 4 couleurs)
- `C` / `M` / `J` / `K` = une couleur primaire (cyan / magenta / jaune / noir)
- `N` = noir (vu dans exemple doc)
- vide = pas d'impression sur cette face (recto seul)

Mapping :
- "quadri" / "4 couleurs" / "CMJN" / "4c" → `Q`
- "1 couleur noire" / "N&B" / "noir" → `N`
- "recto seul" → `verso=""` (vide)
- "R/V" / "recto verso" + même valeur → dupliquer (`Q;Q`)
- Pantone XXX → NON couvert par cette API basique. Marquer `orange` + warning.

### `binding` — assemblage (pour brochures uniquement)

Codes API :
- `PerfectBinding` / `DCC` (Dos Carré Collé)
- `PerfectBindingPUR` / `DCCPUR`
- `SewnBinding` / `DCCC` (Dos Carré Cousu)
- `Stitching2` / `PC` / `piqure cheval` (piqûre 2 points)
- `Stitching3` / `Stitching4`
- `WireO` / `WO` (spirales)
- `Folded` / `NA` (plié non assemblé)
- `Free` / `FreeBinding`

Mapping :
- "piqûre 2 points" / "piqûre cheval" → `Stitching2`
- "dos carré collé" / "DCC" → `PerfectBinding`
- "spirale" / "wire-o" → `WireO`
- "plis roulés" / "dépliant plié" → `Folded`

### `pages` — nombre de pages

Entier. Pour brochure/cahier uniquement. Compte les pages (recto+verso), pas les
feuilles.

# Méthode multi-passes

## Passe 1 — Formatage
Lire le tableau brut. Ignorer en-têtes vides, lignes commentaires, fusions cellules,
séparateurs visuels. Normaliser espaces multiples et casse.

## Passe 2 — Extraction
Pour chaque ligne, identifier :
- Référence client (col "Ref", "Code", etc.)
- Désignation produit (libellé humain)
- Quantité, format, papier, grammage, couleurs, finitions, reliure, pages
- Notes, délai

## Passe 3 — Mapping vers Clariprint
Pour chaque champ source → champ Clariprint :
- Désignation → `type` (selon table ci-dessus). Si hors scope → `OUT_OF_SCOPE` + red.
- Format → `hauteur` × `largeur` (cm, virgule FR).
- Quantité → `qt` (entier).
- Papier qualité → `Qualité` (corriger orthographe/accents).
- Grammage → `grammage` (entier).
- Couleurs recto/verso → codes encres `Q/C/M/J/K/N` ou vide.
- Reliure → `binding`.
- Pages → `pages`.

## Passe 4 — Validation tricolore

Pour CHAQUE champ extrait, attribuer une confidence :
- **`green`** : valeur directe sans ambiguïté (ex : format ISO standard, qualité papier
  reconnue, type courant).
- **`orange`** : valeur INTERPRÉTÉE par l'IA (heuristique de conversion d'unité, libellé
  papier corrigé, grammage déduit par défaut, Pantone simplifié en quadri, doublon
  suspect, etc.). À valider humainement avant envoi.
- **`red`** : valeur manquante ou bloquante (quantité absente, type hors scope API,
  dimensions absurdes, grammage incohérent pour le produit). Le moteur ne pourra pas
  chiffrer.

# Schéma de sortie

## Partie 1 — JSON intermédiaire (pour UI Magrit Core)

```json
{
  "items": [
    {
      "row_id": 1,
      "ref_client": "COM-001",
      "label_source": "Cartes commerciales",
      "type": "feuillet",
      "_type_confidence": "green",
      "hauteur_cm": 5.5,
      "largeur_cm": 8.5,
      "_dimensions_confidence": "green",
      "qt": 500,
      "_qt_confidence": "green",
      "Qualité": "Couché brillant",
      "_qualite_confidence": "green",
      "grammage": 350,
      "_grammage_confidence": "green",
      "recto": "Q",
      "verso": "Q",
      "_encres_confidence": "green",
      "binding": null,
      "pages": null,
      "_extras_confidence": "green",
      "finitions_source": "Pelliculage mat",
      "_finitions_note": "Finitions non supportées par ApiAppelOffre V1 — à traiter hors API ou via extension ultérieure",
      "warnings": []
    }
  ],
  "summary": {
    "total_rows_input": 12,
    "items_chiffrables_par_clariprint": 7,
    "items_hors_scope_api": 5,
    "duplicates_suspected": [["COM-001", "COM-007"]],
    "fully_green_items": 5,
    "items_with_orange": 4,
    "items_with_red": 3,
    "blocking_warnings": [
      "Ligne COM-004 (Affiche événement A2) : type OUT_OF_SCOPE — ApiAppelOffre V1 ne couvre pas les affiches",
      "Ligne COM-005 (Kakémono 80×200 cm) : type OUT_OF_SCOPE — grand format hors scope V1",
      "Ligne COM-006 (Étiquettes adhésives) : type OUT_OF_SCOPE — étiquettes hors scope V1",
      "Ligne COM-009 (Affiche A1) : type OUT_OF_SCOPE",
      "Ligne COM-011 (Banderole 400×100 cm) : type OUT_OF_SCOPE"
    ]
  }
}
```

## Partie 2 — CSV Clariprint (prêt pour ApiAppelOffre)

Produire UNIQUEMENT les lignes chiffrables (filtrer les `OUT_OF_SCOPE`).

```
COLUMNS:
type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso;binding;pages

ROWS:
A!1=feuillet;COM-001;500;5,5;8,5;Couché brillant;350;Q;Q;;
A!2=feuillet;COM-002;2000;14,8;21;Couché brillant;135;Q;;;
A!3=brochure;COM-003;300;21;29,7;Offset;170;Q;Q;PerfectBinding;24
A!4=dépliant;COM-008;1000;21;29,7;Couché mat;135;Q;Q;Folded;
A!5=brochure;COM-012;500;14,8;21;Couché brillant;135;Q;Q;Stitching2;16
A!6=feuillet;COM-001-bis;500;5,5;8,5;Couché brillant;350;Q;Q;;
A!7=feuillet;COM-010;250;10,5;14,8;Vergé crème;250;K;;;
```

(Sept lignes chiffrables sur 12 du fichier brut, conformément au summary du JSON.)

# Règles strictes

- **Référence par ligne obligatoire** : chaque item DOIT avoir un `row_id` (1-indexé sur
  le tableau brut) et un `ref_client` (référence interne du tableau si présente, sinon
  générer `AUTO-001`, `AUTO-002`, …).
- **Détection doublons** : si 2 items ont des paramètres identiques (type + dimensions
  + qt + Qualité + grammage + recto + verso), les signaler dans `duplicates_suspected`.
  NE PAS dédupliquer dans le CSV envoyé (l'imprimeur tranche).
- **Pas d'invention de prix** : tu ne calcules JAMAIS un prix. Seul Clariprint.
- **Mode strict** : si tu ne sais pas un champ, mets `red` + warning explicite. Pas de
  fabrication de données.
- **Sortie complète** : produire le JSON puis le CSV. Pas de phrase introductive, pas de
  commentaire markdown. Délimiter avec des séparateurs clairs (`=== JSON ===` puis
  `=== CSV CLARIPRINT ===`).
- **OUT_OF_SCOPE explicite** : tout type non couvert par l'énumération `feuillet /
  dépliant / brochure / cahier / chemise / cover / encart` doit être marqué
  `type: "OUT_OF_SCOPE"` et exclu du CSV final. Le warning correspondant doit être dans
  `summary.blocking_warnings`.

# Démarrage

Lis maintenant le tableau brut ci-dessous et produis les deux sorties dans l'ordre.

---

TABLEAU BRUT CLIENT :
[coller ici le contenu CSV / Excel / tableau Markdown]
```

---

## Notes d'utilisation (interne, hors prompt)

- **Modèle conseillé** : Claude Sonnet 4.5+ ou Opus 4.6+. Haiku 4.5 OK pour < 30 lignes.
- **Fichier de démo** : `demo-fichier-brut-magrit-core.csv` (12 lignes préparées).
- **Sortie attendue** sur ce fichier :
  - 12 items extraits, dont 7 chiffrables par Clariprint et 5 hors scope.
  - 1 doublon suspect : COM-001 ↔ COM-007 (cartes commerciales identiques).
  - 5 OUT_OF_SCOPE : COM-004 (affiche A2), COM-005 (kakémono), COM-006 (étiquettes),
    COM-009 (affiche A1), COM-011 (banderole).
  - ~3-4 items avec `orange` : grammage manquant ou Pantone simplifié.
  - ~5 items full `green`.
- **Suite démo** :
  1. Afficher le JSON intermédiaire en UI Magrit Core avec colorisation tricolore.
  2. Permettre à l'imprimeur de valider / corriger les `orange` et `red`.
  3. Cliquer "Envoyer à Clariprint" → POST avec le CSV reconstruit (uniquement les items
     validés).
  4. Récupérer SESSION → polling status → afficher prix par ligne.

## À valider avec Xavier avant la démo (questions ouvertes)

1. **Endpoint URL exact** : `mon_domaine/optimprokect/csv.wcl` doit être préfixé par
   quel domaine ? Quel est l'URL prod / staging Clariprint pour la démo ?
2. **Clé API démo** : qui fournit la clé ? Une clé démo dédiée ou la clé prod
   Clariprint AGE ?
3. **Mode async** : pour la démo, on attend le calcul. Doit-on configurer un `callback`
   ou faire du polling `action=status` ? Quel est le timing typique (secondes /
   minutes) ?
4. **Format réponse** : doc dit CSV. Comment Magrit Core parse-t-il les colonnes
   `meilleur_tarif`, `mille_plus`, `fournisseur`, `rang`, etc. en réponse status ?
   Documentation parser disponible ?
5. **Finitions** : ApiAppelOffre V1 documenté n'inclut PAS les finitions (pelliculage,
   vernis, dorure, etc.). C'est un grosse partie du fichier brut client typique. Le
   Solver Clariprint gère-t-il les finitions via d'autres colonnes optionnelles non
   documentées ? Ou via une autre API (Pricing Store ?) ?
6. **Types hors scope** : affiches / kakémonos / banderoles / étiquettes / enveloppes
   représentent une part importante des commandes imprimeur réelles. Roadmap V1
   Clariprint pour couvrir ces formats ? Ou prévu via E47 "Évolution Solver UMM/UBM/UTM"
   du backlog Magrit V1 ?
7. **Couleurs Pantone** : non documentées dans ApiAppelOffre. Comment Clariprint gère
   1 couleur Pantone (qui est plus coûteuse que quadri sur petites quantités) ?
8. **Format dimensions** : cm avec virgule FR confirmé (ex : `29,7`). Toujours
   `hauteur;largeur` dans cet ordre ? Y a-t-il une normalisation orientation
   portrait/paysage côté Clariprint ?
