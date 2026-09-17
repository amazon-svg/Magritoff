---
id: BCP-2-audit
epic: E10 — Gestion commerciale (chantier boutique "chaine des prix Magrit -> panier")
status: fait — audit lecture seule, prerequis de BCP-2
depends_on: []
bloque_rien: cet audit ne bloque plus la levee du prerequis "audit des configurations stockees" (docs/api/CONVENTIONS.md §8.25, point 6)
---
# BCP-2-audit — Audit des configurations produit stockees (prerequis BCP-2)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **3.2** ("Prerequis
de BCP-2, en lecture seule : l'audit des configurations stockees") et point
**3.4 (d) 2** (comptage dorure / soft-touch). **Aucune ecriture en base,
aucun appel Clariprint.** Ce document n'implemente rien de BCP-2 : il mesure.

## Methode

- **Source des donnees : PRODUCTION**, projet Supabase `ightkxebexuzfjdbpsdg`
  (regle projet : audit sur la production d'abord, cf.
  `feedback_audit_prod_avant_heuristique`). L'acces a reussi : la lecture
  s'est faite via l'API REST PostgREST du projet (`GET .../rest/v1/<table>`),
  avec la clef de service lue depuis `.env.test` (`SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`, deja presente dans le depot, pointant sur ce
  meme projet — verifie par comparaison avec `VITE_SUPABASE_URL` de
  `.env.local`). Aucune clef ni jeton n'est reproduit dans ce document, dans
  le script, ni dans aucune sortie de commande commitee.
- **Aucune requete SQL libre** : le CLI Supabase ne l'offre pas (contrainte
  du mandat) — remplacee par une pagination REST (`Range`/`offset`/`limit`,
  page de 500), suffisante ici puisque les deux tables tiennent en une seule
  page (14 et 117 lignes).
- **Tables auditees** : `public.shop_products` (colonne `config jsonb`,
  produits de **boutique**) et `public.product_library` (colonne
  `config jsonb`, produits de **bibliotheque**) — ce sont les deux seules
  tables du depot portant un `config jsonb` alimentant `clariprintData`
  (verifie par recherche des usages de `clariprintData` dans `src/`, tous
  remontant a `product.config` d'un `ShopProduct`).
- **Extraction** : pour chaque ligne, `config.clariprintData` si la cle
  existe (forme imbriquee), sinon `config` lui-meme (forme "a plat") — c'est
  exactement la regle deja lue par `extractInitialOptions`
  (`ProductOverlay.helpers.ts:239`, `const c = (cfg?.clariprintData ?? cfg
  ?? {})`), pour ne pas inventer une regle d'extraction differente de celle
  du code qui consomme reellement cette donnee.
- **Outil** : `scripts/diagnostics/stored-config-audit/run.mjs` (neuf, lecture
  seule — uniquement des `GET` PostgREST, jamais un `POST`/`PATCH`/`DELETE`,
  jamais un appel Clariprint). Classe la **forme** de chaque champ
  (`string`/`number`/`array(n)`/`object[cles]`/`absent`/`null`) sans jamais
  reproduire une valeur commerciale ou personnelle en clair, sauf les codes
  de finition et les valeurs de `kind` (vocabulaire produit, pas une donnee
  personnelle ni un prix).
- **Execution** : `node scripts/diagnostics/stored-config-audit/run.mjs`,
  deux fois (avant et apres extension du detecteur de formes inattendues),
  sorties identiques sur les compteurs. Sortie complete conservee dans le
  scratchpad de session, pas commitee (elle ne contient rien de nouveau par
  rapport aux tableaux ci-dessous).

## Volumetrie

| Table | Lignes totales | Config non vide | `clariprintData` imbrique | `clariprintData` "a plat" (= `config`) |
|---|---:|---:|---:|---:|
| `shop_products` (boutique) | 14 | 14 (100%) | 11 | 3 |
| `product_library` (bibliotheque) | 117 | 117 (100%) | 114 | 3 |
| **Total** | **131** | **131 (100%)** | **125** | **6** |

Les 131 produits de production portent une configuration exploitable (aucun
`config` vide ou `null`). La forme imbriquee (`config.clariprintData`)
domine tres largement (125/131, 95%) ; la forme "a plat" est marginale mais
non nulle (6/131) — les deux formes que le code sait deja lire coexistent
bien en production.

## Repartition par champ

### `width` / `height`

| Forme | `shop_products` | `product_library` | Total |
|---|---:|---:|---:|
| chaine (canonique, cm) | 11 | 30 | 41 |
| nombre (legacy, mm — convention P0.9) | 0 | 25 | 25 |
| absent | 3 | 62 | 65 |

Les deux formes anticipees par le point 3.2 (chaine cm canonique, nombre mm
legacy converti par `toMm`/la division par 10) coexistent reellement en
production : **le normaliseur doit gerer les deux**, ce que le cadrage
prevoit deja. L'absence (65/131, 50%, presque toute en bibliotheque) est
attendue pour des produits de bibliotheque encore au stade de gabarit,
dimensionnes seulement au moment de la configuration.

### `papers`

| Forme | `shop_products` | `product_library` | Total |
|---|---:|---:|---:|
| objet `{custom: {...}}` (canonique) | 11 | 30 | 41 |
| absent | 0 | 81 | 81 |
| chaine (`paper` singulier, legacy) | 3 | 3 | 6 |
| tableau a un element | 0 | 3 | 3 |

**Deviation non documentee au point 3.2** : 9 produits (6 en chaine, 3 en
tableau) portent `papers`/`paper` hors de la forme objet. Contrairement a
`width`/`height`, le point 3.2 ne decrit **aucune** regle de conversion pour
ces formes brutes — c'est une forme que le normaliseur devra traiter
explicitement, faute de quoi ces 9 produits deviendraient non chiffrables
des l'entree en vigueur du schema strict.

L'absence de `papers` dans 81/117 (69%) des produits de bibliotheque est
volumetriquement notable : au sens strict du point 3.2 ("absente →
configuration non chiffrable, aucune qualite inventee"), ces produits
retomberaient tous sur le prix marche tant qu'une qualite n'est pas
renseignee. Ce n'est pas une forme inattendue — c'est la regle deja ecrite
— mais son impact n'avait pas ete chiffre avant cet audit.

### `front_colors` / `back_colors`

| Forme | `shop_products` (front / back) | `product_library` (front / back) |
|---|---:|---:|
| tableau de codes (canonique) | 11 / 11 (0 pour back : `array(0)`=9, `array(1)`=2) | 30 / 30 (`array(1)`=22, `array(0)`=8) |
| nombre brut (legacy, `4`/`0`) | 0 / 0 | 3 / 3 |
| absent | 3 / 3 | 84 / 84 |

Le nombre brut (`4-color` code par `4`, aucun ink par `0`) est **anticipe**
par le point 3.2 (« `4` → `["4-color"]`, `0` → `[]` ») : ce n'est pas une
forme inattendue, c'est la confirmation que la conversion documentee
correspond a une forme reellement stockee (3 produits de bibliotheque).

### `kind`

| Valeur | `shop_products` | `product_library` |
|---|---:|---:|
| `leaflet` (canonique) | 11 | 93 |
| `book` (canonique) | 0 | 7 |
| `folded` (canonique) | 0 | 6 |
| absent | 3 | 2 |
| `flyer` | 0 | 1 |
| `menu` | 0 | 1 |
| `plv` | 0 | 1 |
| `panneau` | 0 | 1 |
| `calendrier` | 0 | 1 |
| `packaging` | 0 | 1 |
| `adhesif` | 0 | 1 |
| `drapeau` | 0 | 1 |
| `papeterie` | 0 | 1 |

**C'est la deviation la plus significative de cet audit.** 9 produits de
bibliotheque (7,7% de `product_library`) portent une valeur de `kind` hors
de l'enumeration canonique `leaflet`/`folded`/`book`. Le point 3.2 ne
documente qu'un mappage `"flyer"`, `"affiche"`, `"carte"` → `"leaflet"` :
- `flyer` (1 occurrence) **est couvert** par ce mappage documente — et
  confirme au passage, sur une donnee reelle, le defaut deja signale par ce
  cadrage lui-meme (`ProductOverlay.helpers.ts:301` pose `"flyer"` par
  defaut, point 3.2, ligne `kind`) ;
- **`menu`, `plv`, `panneau`, `calendrier`, `packaging`, `adhesif`,
  `drapeau`, `papeterie` (8 produits, 1 occurrence chacun) n'ont AUCUN
  mappage documente.** Sous le schema strict prevu par BCP-1b/BCP-2 (« valeur
  inconnue → refus, jamais de defaut »), ces 8 produits seraient refuses en
  422 des la premiere tentative de chiffrage, sans qu'aucune regle de
  cadrage ne dise vers quelle valeur canonique les faire correspondre.

### Finitions (`finishing_front` / `finishing_back`)

| Valeur | `shop_products` | `product_library` |
|---|---:|---:|
| `""` (aucune finition) | 18 | 39 |
| `PELLIC_ACETATE_BRILLANT` | 3 | 5 |
| `PELLIC_ACETATE_MAT` | 1 | 15 |
| `UVS_MAT_RESERVE` | 0 | 1 |
| `brillant` (libelle humain brut, pas un code) | 0 | 1 |

Les codes `PELLIC_ACETATE_*` et `UVS_MAT_RESERVE` sont des codes Clariprint
plausibles (referentiel du point 5.3 a completer par l'architecte). Une
occurrence de `brillant` en minuscule, sans le prefixe `PELLIC_ACETATE_`,
est un libelle humain brut plutot qu'un code du referentiel — deviation
mineure (1/131), a couvrir par la table de synonymes du point 5.3.

**Comptage dorure et soft-touch (point 3.4 (d) 2), ce que le masquage
retire reellement aux acheteurs** :

| | `shop_products` | `product_library` | Total |
|---|---:|---:|---:|
| Champ `dorure` present (n'importe quelle valeur) | 0 | 0 | **0** |
| `dorure` non vide (`"or"`/`"argent"`, hors `"aucune"`) | 0 | 0 | **0** |
| Finition contenant "dorure" (recto/verso) | 0 | 0 | **0** |
| Finition correspondant a "soft-touch" (recto/verso) | 0 | 0 | **0** |

**Aucun des 131 produits de production (boutique et bibliotheque confondus)
ne porte une configuration chiffrable de dorure ou de soft-touch.** Un seul
residu textuel a ete trouve, hors de tout champ structure : le champ libre
`reference` d'un produit de bibliotheque contient la chaine `"packaging
dorure or"` (texte descriptif, jamais envoye a Clariprint comme option de
finition). **Conclusion chiffree pour Arnaud** : le masquage tranche le
2026-09-16 (Q3, point 3.4) ne retire aujourd'hui **aucune** configuration
deja fonctionnelle a un acheteur ou a un atelier — ni la dorure ni le
soft-touch ne sont utilises comme option chiffrable sur un produit reel.

## Formes inattendues (liste brute, produite par l'outil)

20 signalements au total (3 sur `shop_products`, 17 sur `product_library`),
regroupes par cause :

1. **`kind` hors enumeration canonique, sans mappage documente** — 8
   produits (`menu`, `plv`, `panneau`, `calendrier`, `packaging`, `adhesif`,
   `drapeau`, `papeterie`), tous en `product_library`.
2. **`kind: "flyer"`** — 1 produit en `product_library` ; couvert par le
   mappage deja documente au point 3.2, signale pour memoire seulement.
3. **`papers`/`paper` hors forme objet canonique** — 9 produits (6 en
   chaine, 3 en tableau a un element), repartis sur les deux tables.
4. **`front_colors`/`back_colors` en nombre brut plutot qu'en tableau** — 3
   produits en `product_library` (mais **anticipes** par le point 3.2, voir
   plus haut : ce n'est pas une lacune du cadrage).
5. **Motif "dorure" hors des cles anticipees** — 1 produit en
   `product_library`, dans le champ libre `reference` (texte descriptif,
   sans effet sur le chiffrage — voir comptage dorure ci-dessus).

Aucun `null` inattendu, aucune configuration vide, aucune forme non
classable rencontree en dehors de cette liste.

## Conclusion — les formes canoniques du point 3.2 tiennent-elles ?

**Oui pour la majorite des produits, non sans reserve pour `kind` et
`papers`.**

- **`width`/`height`, `front_colors`/`back_colors`** : les deux formes
  observees en production (canonique et legacy) sont **toutes deux deja
  anticipees** par le texte du point 3.2. Rien a rouvrir : c'est une
  confirmation, pas une alerte.
- **`papers`** : la forme canonique domine (41/131) mais **9 produits
  (6,9%) portent une forme (chaine ou tableau) que le point 3.2 ne convertit
  pas explicitement**, a la difference de `width`/`height` qui a sa regle
  P0.9 ecrite. **Recommandation** : avant l'ecriture du contrat OpenAPI de
  BCP-1b/BCP-2, l'architecte devrait ajouter une regle de normalisation pour
  `paper` singulier (chaine) et `papers` (tableau a un element) vers l'objet
  canonique, ou trancher explicitement qu'ils restent non chiffrables.
- **`kind`** : c'est le point ou le cadrage **doit etre rouvert au sens
  strict de sa propre clause** (« une forme non prevue ici rouvre ce
  cadrage »). **8 produits de bibliotheque portent une valeur de `kind`
  sans aucun mappage documente** vers `leaflet`/`folded`/`book`. Sous le
  schema strict prevu, ces produits seraient refuses en 422 des la mise en
  service de BCP-1b/BCP-2, sans qu'un dev-story sache aujourd'hui vers quoi
  les faire correspondre (un `panneau` ou un `drapeau`, par exemple, n'ont
  pas d'equivalent evident parmi les trois valeurs canoniques). **Ce point
  est remonte, pas tranche ici** : conformement a la regle de methode du
  §8.25 (« si un dev-story constate un ecart avec ce cadrage, il le remonte,
  il ne le tranche pas en silence »).
- **`dorure`/`soft-touch`** : **zero occurrence structuree** sur les 131
  produits examines. Le comptage exige par le point 3.4 (d) 2 est fait :
  le masquage du 2026-09-16 ne retire aucune configuration fonctionnelle
  existante.

## Ce que ce document NE fait pas

- Aucune ecriture en base, aucune modification de donnee.
- Aucun appel Clariprint (le script n'importe ni n'invoque aucun client
  Clariprint).
- Aucune modification de `openapi/magrit-core.v1.yaml` ni de
  `docs/api/CONVENTIONS.md` (reserve a l'agent `architecte`).
- Aucune implementation de BCP-2 : ni normaliseur, ni changement d'UI, ni
  test de contrat. Ce document est un audit, pas une story.

## Fichiers

- `scripts/diagnostics/stored-config-audit/run.mjs` (neuf) — script de
  lecture seule, source de toutes les donnees ci-dessus. Reexecutable a tout
  moment (`node scripts/diagnostics/stored-config-audit/run.mjs`), sans
  argument, sans ecriture, sans appel Clariprint.
- `_bmad-output/implementation-artifacts/story-BCP-2-audit.md` (neuf) — ce
  document.

## Tests executes

- `node scripts/diagnostics/stored-config-audit/run.mjs` execute deux fois
  contre la production (`ightkxebexuzfjdbpsdg`), sorties coherentes entre
  elles sur tous les compteurs partages. Pas de test automatise dedie : le
  script n'est pas une capacite livree en continu (pas d'endpoint, pas de
  logique metier a couvrir), il est reexecutable a la demande, dans le meme
  esprit que le banc `scripts/diagnostics/clariprint-variants/` deja au
  depot.
- Verification manuelle du seul signalement "motif dorure hors cles
  anticipees" par une requete `GET` cible sur l'id concerne (lecture seule,
  id non commercial, resultat interprete ci-dessus sans reproduire le texte
  brut integral).

## Criteres d'acceptation (implicites, mandat du message de lancement)

1. **Volumetrie donnee (produits examines, produits avec configuration)** —
   fait : 131 produits (14 boutique + 117 bibliotheque), 131/131 avec
   configuration non vide.
2. **Type de `width`/`height` (nombre/chaine/unite/absent)** — fait, tableau
   ci-dessus.
3. **Forme de `papers` (tableau/objet/chaine, codes/libelles)** — fait,
   tableau ci-dessus, deviation signalee.
4. **Forme des couleurs** — fait, tableau ci-dessus.
5. **Valeurs distinctes de `kind`** — fait, tableau ci-dessus, 9 valeurs
   hors enumeration canonique identifiees et nommees.
6. **Valeurs distinctes de finition, avec comptage `dorure`/`soft-touch`** —
   fait : 0 occurrence structuree des deux, 1 residu textuel non fonctionnel
   dans un champ libre.
7. **Formes inattendues** — fait, section dediee, 20 signalements bruts
   regroupes en 5 causes.
8. **Conclusion sur la tenue des formes canoniques du point 3.2** — fait,
   avec un point explicitement remonte (`kind`) et une recommandation
   (`papers`).
9. **Lecture seule, aucune ecriture, aucun appel Clariprint** — respecte :
   le script ne fait que des `GET` PostgREST, verifie par lecture de son
   code (pas de `POST`/`PATCH`/`DELETE`, aucun import d'un client
   Clariprint).
10. **Aucune clef ni jeton affiche** — respecte : ce document et la sortie
    du script ne portent que des identifiants de projet Supabase (deja
    publics, ce sont des URLs) et des ids de lignes (UUID internes, sans
    valeur commerciale).
