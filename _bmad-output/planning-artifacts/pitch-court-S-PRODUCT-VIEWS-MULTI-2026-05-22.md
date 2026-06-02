---
title: Pitch court S-PRODUCT-VIEWS-MULTI — 2D multi-vues vs 3D three.js
date: 2026-05-22
author: Mary (Analyst BMAD) — délégué via agent Plan
context: Phase 0.7 cadrage qualité roadmap v1.1+
status: ✅ DÉCISION ACTÉE Arnaud 2026-05-22 — Option A 2D multi-vues pour Sprint 7 + story future 3D packaging tracée pour V2+ (élargissement catalogue confirmé sous 6 mois)
predecessor: roadmap-v1.1-qualite-first-2026-05-21.md
recommendation: Option A (2D multi-vues, Sprint 7, 2-3j) — confirmée
arnaud_arbitrages_2026_05_22:
  Q-ROADMAP: "OUI — élargissement packaging / boîte pliée / présentoir / display 3D prévu sous 6 mois (=> tracer story future S-PRODUCT-VIEWS-3D-PACKAGING pour V2+, mais PAS dans Sprint 7)"
  Q-SIGNAL-CLIENT: "NON — aucun signal client explicite demandant rotation 3D (ICI, Cordi, Tessier, démo 18/05)"
  Q-SCOPE-PLV: "2D suffit — vue contextuelle premium intégrée dans S-PIM-VISUELS-1 (biblio Magrit 10 fonds) couvre 80% du besoin PLV/signalétique"
decision_finale: Option A confirmée pour S-PRODUCT-VIEWS-MULTI Sprint 7 (2-3j). Option B explicitement reportée et conditionnée à l'arrivée effective du packaging dans le catalogue produit (story future à formaliser à ce moment-là, pas en avance).
---

## ⚡ Décision finale Arnaud 2026-05-22

**Option A (2D multi-vues) validée pour S-PRODUCT-VIEWS-MULTI Sprint 7.**

Arnaud a répondu aux 3 questions résiduelles le 2026-05-22 (post pitch Mary) :

| Question | Réponse | Conséquence |
|---|---|---|
| Q-ROADMAP : élargissement packaging sous 6 mois ? | **Oui** | ⚠️ Story future `S-PRODUCT-VIEWS-3D-PACKAGING` à tracer dans backlog V2+ — sera spec et estimée quand le premier produit packaging entre dans le catalogue. PAS DANS Sprint 7. |
| Q-SIGNAL-CLIENT : signal explicite demande 3D ? | **Non** | Aucun blocker commercial = pas d'urgence à investir dans la 3D maintenant. |
| Q-SCOPE-PLV : vue contextuelle 2D suffit ? | **Oui (2D suffit)** | Pas de story S-PRODUCT-VIEWS-CONTEXT-PLV séparée. Le besoin PLV est absorbé par S-PIM-VISUELS-1 (bibliothèque Magrit 10 fonds pré-conçus). |

**Conclusion** : Option A confirmée sans réserve pour le périmètre print plat actuel. Une **story future** est tracée pour V2+ packaging (sans urgence ni spec détaillée maintenant — on la formalisera quand le besoin business deviendra concret, conformément au principe MASTER_CONTEXT *"service avant produit, pas d'investissement produit profond sans validation commerciale préalable"*).

---



# Pitch court — S-PRODUCT-VIEWS-MULTI : 2D multi-vues vs 3D three.js

**Pour :** Arnaud, décision PO Magrit
**Date :** 2026-05-22

---

## 1. Synthèse exécutive

**Conclusion en une phrase :** dans le contexte Magrit (web-to-print B2B français, persona primaire deviseur imprimeur, démo Groupe ICI en pivot commercial actuel), la 3D three.js est une réponse technique surdimensionnée à un besoin qui n'a pas encore été exprimé — l'option 2D multi-vues règle 95 % du besoin acheteur réel pour 30 % du coût total et zéro dette technique.

**3 critères différenciateurs entre A et B :**

1. **Alignement persona** : le deviseur imprimeur (persona primaire) ne tire aucun bénéfice métier d'une rotation 3D ; l'acheteur B2B (persona secondaire) veut surtout voir "ce qu'il achète", pas jouer avec un modèle.
2. **Coût total réel** : A reste dans la stack actuelle (resvg-wasm, SVG, edge function existante) ; B impose un second pipeline rendu côté client + R&D modélisation 3D + +750 kB JS sur le bundle.
3. **Composition 3 layers S-PIM-VISUELS** : A est nativement compatible (4e layer = vue 2 du produit) ; B oblige à refondre partiellement la composition shop-scoped déjà cadrée Phase 0.5.

**Recommandation finale : Option A (2D multi-vues)**, argument-clé = *lesson Arnaud 2026-05-18* : *"si un résultat cible existe déjà via une capacité native, ne pas construire de surcouche pour le reproduire"*. Le pipeline resvg-wasm produit déjà le résultat cible avec une story de 2-3 jours. La 3D est un *wow effect* qui ne sert pas le métier imprimeur.

---

## 2. Le besoin business — qu'est-ce que voit vraiment l'acheteur ?

**User journey acheteur B2B (Pierrot du Groupe ICI, ou son commercial en RDV client) :**

Pierrot ouvre `/shop/groupe-ici`, cherche "carte de visite 500 ex 350g pelliculage mat", l'IA propose 3 configurations. À ce moment précis, qu'a-t-il besoin de voir ? Il a besoin de **valider que c'est bien le produit qu'il commande** : forme, format, finition générale, sens (recto/verso si bi-face), aperçu lisible sur écran téléphone (rappel séquence 2 démo ICI : *"vos commerciaux peuvent faire ça depuis un téléphone, en rendez-vous client"*).

Décomposons par typologie produit — le besoin n'est PAS uniforme :

| Famille produit | Besoin visuel acheteur réel | 2D multi-vues suffit ? | 3D apporte quoi ? |
|---|---|---|---|
| **Carte de visite** | Recto + verso, finition (mat/brillant) reconnaissable | ✅ 100 % | Rien — la carte est plate, la rotation 3D ne montre que l'épaisseur du papier qui n'est pas un argument d'achat |
| **Flyer A5/A4** | Recto + verso, voir le pli si bi-volet | ✅ 95 % | Animation pli = sympa mais zéro impact achat |
| **Brochure A4 plié** | Cover + intérieur, idée du pliage | ✅ 90 % (déjà partiellement S4.2 brochure 2 panneaux) | Animation feuilletage = jouet, pas outil de décision |
| **Kakémono** | Voir le visuel avec stand + échelle humaine | ⚠️ 70 % | Vue 3D avec stand + scale humain = *peut* avoir du sens (perception d'encombrement physique) |
| **PLV comptoir / dibond signalétique** | Voir le rendu en contexte (sur un comptoir, sur un mur) | ⚠️ 60 % | Vue 3D contextuelle = *peut* avoir du sens (différenciant signalétique vs Cadratin, cf. positionnement ICI) |
| **Étiquette** | Voir la forme + texte | ✅ 100 % | Rien |
| **Packaging plié, boîte, présentoir** (hors backlog v1.1) | Voir la 3D déplié vs plié | ❌ 30 % | 3D nécessaire |

**Constat majeur :** sur les **5 templates MVP livrés S4.2** (flyer, carteVisite, brochure, etiquette, kakemono), **4 sur 5 sont du print plat** où la 3D n'apporte rien que la 2D bien faite ne fasse mieux (plus rapide à charger, plus net, plus accessible). Le seul cas où la 3D commence à se justifier — le kakémono avec stand + scale — peut être traité par une **vue 2D "en contexte"** (le kakémono devant un mur stylisé avec personnage silhouette pour l'échelle), pas par un rendu 3D temps réel.

**Niveau de réalisme suffisant pour le métier print B2B :** le client B2B (Pierrot, ses commerciaux, son client retail) achète à la confiance. Il a besoin de **reconnaître son produit**, pas de l'admirer sous tous les angles. Le wow effect 3D est un **réflexe de pure player W2P consumer** (Vistaprint, Moo) qui cible un acheteur final particulier non-expert. Magrit cible *l'imprimeur Pro + son acheteur B2B compte*, qui veulent surtout aller vite et avoir confiance.

**Cas "wow effect inutile" à risque réel :** un rendu 3D mal calibré devient un **gimmick contre-productif** — il signale "produit grand public" alors que Magrit positionne "couche de calcul B2B sérieuse, complémentarité Cadratin/Darius". La 3D décrédibilise le positionnement ICI ("devis augmenté", pas "configurateur jouet").

---

## 3. Tableau comparatif Option A vs Option B

| # | Critère | Option A (2D multi-vues) | Option B (3D three.js) | Avantage |
|---|---|---|---|---|
| 1 | Effort dev story | 2-3j (extension pipeline SVG + UI carrousel) | 5-7j base + modélisation 3D (??) | **A** |
| 2 | R&D modélisation | Aucune — templates SVG déjà existants à dupliquer recto/verso | **Bloquante** : qui modélise les 5 produits 3D ? Sally pas formée, RPP pas blender-expert, achat assets externes coûteux et génériques | **A** |
| 3 | Bundle front impact | 0 kB (composant React natif + URLs CDN existantes) | **+750 kB gz** (three.js 600 + r3f 50 + drei 100). Baseline 245 kB → ~995 kB (+306 %). Désastre Lighthouse mobile | **A** |
| 4 | Perf perçue | < 50 ms (HIT CDN) / < 300 ms (MISS) — NFR2 atteinte | Démarrage scène 3D = 800-1500 ms typiques + GPU dépendant. Mobile bas de gamme = saccades | **A** |
| 5 | Qualité visuelle (B2B print plat) | Excellente — réplique fidèle 2D | Trompe-l'œil 3D qui peut paraître "fake" si éclairage/textures mal calibrés | **A** (paradoxe) |
| 6 | Qualité visuelle (kakémono/PLV) | Moyenne — mockup 2D "en contexte" reste schématique | Bonne (vue contextuelle avec scale) | **B** (cas limité) |
| 7 | Alignement stack actuelle | 100 % — extension naturelle de S4.1b/c/3 + S-PIM-VISUELS | Rupture paradigme : nouveau pipeline client-side, sort de l'edge-rendered SVG-first | **A** |
| 8 | Dette technique introduite | Faible (un peu plus de SVG, déjà testé) | Élevée — three.js a sa propre courbe maintenance (versions, breaking changes drei/r3f) | **A** |
| 9 | Accessibility a11y (DoD #10) | Maîtrisée — `<img alt>` + skeleton + fallback SVG (conforme S4.3) | **Problématique** — canvas WebGL pas accessible nativement, nécessite alt textuel parallèle + alternative non-canvas pour lecteurs d'écran | **A** |
| 10 | SEO / screenshot share / preview | Native — URLs PNG indexables par bots et partageables (Slack/email previews fonctionnent) | Canvas = invisible au crawler + 0 preview Slack/email. Nécessite fallback PNG = on retombe sur A en parallèle | **A** |
| 11 | Mobile / touch UX | Carrousel swipe natif iOS/Android, pattern UX maîtrisé | Pinch/rotate 3D = UX pénible sur mobile, surface tactile petite, batterie GPU drainée | **A** |
| 12 | Dépendance libs tierces | 0 nouvelle dépendance (resvg-wasm déjà là) | 3 nouvelles deps (three, @react-three/fiber, @react-three/drei) + écosystème exemple/loader/etc. | **A** |
| 13 | Compat S-PIM-VISUELS (composition 3 layers shop-scoped) | Native — la "vue 2" du produit s'intègre comme un 4e layer dans le pipeline edge | Refonte partielle : il faut soit rendre la 3D côté client par-dessus background composé côté edge (UX flicker), soit tout migrer 3D (pertes drastiques) | **A** |
| 14 | Compat Canva integration (S5.2 V2+) | Compatible — Canva renvoie un PNG, on l'intègre comme nouveau layer | Complexe — Canva ne fait pas du 3D natif, pipeline hybride 2D/3D | **A** |
| 15 | Maintenance long terme | Faible — templates SVG = code lisible par tout dev React/TS | Élevée — three.js scene graph, shaders, R&D régressions GPU vendor-specific | **A** |
| 16 | Formation équipe RPP (Damien, Sébastien) | 0 — ils savent déjà SVG + React | three.js + r3f = courbe sérieuse 2-3 semaines d'autonomie | **A** |
| 17 | Différenciation commerciale ICI | Modérée — "mockup 2D pro" = standard W2P attendu | Forte... *mais sur le mauvais axe* (gadget pas couche de calcul) | **A** (cohérence positionnement) |

**Score : 16/17 critères favorisent A, 1 critère limite favorise B (kakémono/PLV contextuel).**

---

## 4. Coût total réel — au-delà de l'effort dev

### Option A — coût caché

| Poste | Coût estimé |
|---|---|
| Dev story S-PRODUCT-VIEWS-MULTI | 2-3 j RPP |
| Extension templates SVG (recto/verso pour 5 templates × ~50 lignes) | inclus dans 2-3j |
| UI carrousel MockupImage (state machine, tests vitest, testIds) | inclus |
| Doc/ADR architecture | 0.5j |
| **TOTAL A** | **~3 j** |

### Option B — coût caché (le diable est ici)

| Poste | Coût estimé | Risque |
|---|---|---|
| Dev story base three.js + r3f intégration | 5-7 j RPP | Maîtrisé |
| **Modélisation 3D 5 produits** (carte, flyer, brochure, étiquette, kakémono) | **??? — INCONNU** | **Bloquant** — qui modélise ? Sally fait du Figma, pas du Blender. Estimation marché : 1-3j par modèle + textures = **5-15 j externes** ou achat assets génériques |
| Bundle bloat +750 kB → impact Lighthouse score mobile | -10 à -20 points perf | Casse NFR perf actuelle |
| R&D éclairage / matériaux papier / finitions (pelliculage = transparence + spéculaire) | 2-3 j | Inconnu — la finition pelliculée est *exactement* ce que les acheteurs B2B regardent, mal rendre = pire qu'absent |
| A11y alternative non-canvas (DoD #10) | 1-2 j | Double maintenance perpétuelle |
| Fallback PNG pour SEO/preview Slack/email | 1 j | = on garde A en parallèle ! |
| Formation équipe RPP three.js (Damien + Sébastien) | 2-3 j chacun | Coût récurrent à chaque turnover |
| Maintenance future (breaking changes r3f/drei tous les 6 mois) | 0.5-1 j / semestre récurrent | Dette permanente |
| **TOTAL B** | **15-30 j first delivery + dette perpétuelle** | |

**Ratio coût : A = 3j, B = 15-30j minimum. Facteur 5 à 10×.**

**Et surtout : "qui fait les modèles 3D ?" est une question non résolue.** Aucun RPP n'est designer 3D. Sally fait du UX 2D. Acheter des assets génériques sur TurboSquid/Sketchfab = produits *qui ne ressemblent pas aux livrables Magrit*. Modéliser sur mesure = 800-2000 €/produit × 5 produits = budget hors stack RPP non prévu.

---

## 5. Cas d'usage où chaque option gagne

### Option A (2D multi-vues) gagne SI :

1. **Magrit reste positionnée "couche de calcul intelligente B2B"** (cf. positionnement ICI explicite : pas un configurateur jouet).
2. **Le persona primaire reste le deviseur imprimeur** qui veut aller vite, pas un acheteur final qui joue avec la 3D.
3. **Le catalogue reste majoritairement print plat** (carte, flyer, brochure, étiquette, affiche).
4. **La roadmap qualité-first impose de minimiser dette technique et bundle** (DoD #10 a11y, NFR perf actuelle).

### Option B (3D three.js) gagne SI :

1. **Magrit pivote vers du packaging / PLV 3D / signalétique volumétrique massive** (donc on quitte le print 2D plat — pas dans backlog v1.1).
2. **Le positionnement bascule "configurateur grand public B2B2C"** style Vistaprint / Moo / Canva Print (incompatible positionnement ICI actuel).
3. **Magrit a un budget design 3D externe (~10-30 j freelance Blender) débloqué** et un mainteneur three.js dédié.
4. **Le client a explicitement demandé "rotation 3D du produit"** comme blocker commercial — *à ce jour, aucun signal exprimé par ICI, Pro deviseurs ou démo 18/05*.

**Verdict honnête :** aucune des 4 conditions B n'est remplie aujourd'hui. Les 4 conditions A sont toutes vérifiées.

---

## 6. Recommandation argumentée

**Recommandation : Option A — 2D multi-vues, Sprint 7, 2-3 jours.**

**3 raisons principales :**

1. **Cohérence positionnement commercial démontré démo ICI 2026-05-18.** Le succès de la démo Groupe ICI repose sur le pitch *"couche de calcul intelligente, complémentaire Cadratin/Darius, devis augmenté"*. Une 3D rotative pousse Magrit vers le segment configurateur jouet — exactement le mauvais signal vis-à-vis de Pierrot et Julien qui jugent une plateforme B2B sérieuse à sa précision OF, pas à son wow effect.

2. **Lesson Arnaud 2026-05-18 directement applicable.** Le pipeline resvg-wasm produit déjà des mockups 2D nets, paramétriques, performants. Ajouter three.js par-dessus = construire une surcouche pour reproduire ce que la stack existante sait déjà faire — antipattern explicite documenté. Le réflexe correct = étendre l'existant, pas dupliquer le paradigme.

3. **DoD qualité-first principes #2, #5, #7, #10.** Option B viole : #7 (story > 3j = scinder, B = 5-7j base + 5-15j modélisation hors RPP), #10 (canvas WebGL = pas a11y native sans double maintenance), et casse le bundle baseline 245 kB (impact Lighthouse mobile mesurable). Option A respecte tous les principes natively.

**1 contre-argument honnête (ce qu'on perd avec A) :**

Le **kakémono et la PLV / signalétique** — pile la zone aveugle de Cadratin que ICI veut combler — sont les 2 produits où une 3D contextuelle (kakémono avec stand + scale humain, PLV sur comptoir stylisé) apporterait *un peu* de valeur de visualisation pour le client retail final. **Mais** cette valeur peut être adressée à 80 % par une **vue 2D "en contexte"** : kakémono dessiné avec stand + silhouette humaine d'échelle, PLV dessinée sur fond de comptoir. C'est exactement le terrain de la story S-PIM-VISUELS-1 (bibliothèque Magrit 10 fonds pré-conçus) — combiner *fond contextuel* + *gabarit produit* donne 80 % du résultat 3D pour 0 effort additionnel.

Si dans 6-12 mois Arnaud constate qu'un client signe explicitement à condition d'avoir la 3D (signal commercial concret), on reposera la question à ce moment-là. Pour l'instant : signal absent, donc pas de pari technologique.

---

## 7. Impact roadmap si Arnaud choisit A vs B

### Si Option A (recommandée)

- **Sprint 7** inclut S-PRODUCT-VIEWS-MULTI (2-3j) **en complément** des 6 sous-stories S-PIM-VISUELS-1/2/3/4/5/6 (10-12j). Total Sprint 7 ≈ 12-15 jours (1 RPP = 2-3 semaines, 2 RPP = 1.5 semaine).
- **Compatibilité S-PIM-VISUELS-5** (composition 3 layers) : native — la "vue verso/recto" devient un 4e layer dans le pipeline edge, cache key étendue de manière triviale.
- **Roadmap qualité-first reste alignée** sur la séquence S5/S6/S7/S8 actuellement cadrée.
- **Démo prochaine ICI / autre prospect** : démontrable J+15 max.

### Si Option B

- **Sprint 7-bis dédié** nécessaire (5-7j dev + 5-15j modélisation 3D externe). Glissement Sprint 8/9 d'au moins 2-3 semaines.
- **S-PIM-VISUELS-5 doit être refondu partiellement** : la composition 3 layers shop-scoped (background + product shape SVG) prévue côté edge n'est plus suffisante — il faut soit rendre la 3D côté client par-dessus une image composée côté edge (UX flicker + double pipeline), soit migrer toute la chaîne en 3D (perte fonds personnalisables 2D = casse pivot Arnaud 2026-05-21).
- **Budget design 3D non prévu** dans roadmap qualité-first — à débloquer hors stack RPP, conflit avec principe "service avant produit" du MASTER_CONTEXT (pas d'investissement produit profond sans validation commerciale).
- **Bundle 245 kB → ~995 kB** : casse NFR perf actuelle, oblige stratégie code-splitting agressive (lazy import three.js uniquement sur ProductCard détail) = encore plus de dev.

---

## 8. Questions à clarifier avec Arnaud avant décision finale

Pour fermer la décision en toute confiance, 3 incertitudes à trancher :

1. **Q-ROADMAP** : Magrit prévoit-elle d'élargir le catalogue v1.x à du packaging / boîte pliée / présentoir / display 3D (où la 3D serait vraiment justifiée) ou reste-t-on cadré print plat carte/flyer/brochure/étiquette/kakémono/affiche/signalétique plate ? Si élargissement packaging confirmé sous 6 mois → repenser sérieusement B (mais pas Sprint 7).

2. **Q-SIGNAL-CLIENT** : Y a-t-il eu un seul signal — ICI, Cordi, autre prospect, Marc Tessier W2P pure player — qui a explicitement demandé une visualisation 3D rotative comme critère d'achat ou de différenciation ? À ma connaissance (mémoire `reference_client_groupe_ici.md`, démo 18/05) : aucun signal. Mais à confirmer côté CRM/notes terrain.

3. **Q-SCOPE-PLV** : Pour la zone "signalétique / PLV" (douleur Cadratin explicite ICI 25 % activité), souhaite-t-on viser un rendu "produit en contexte" qui pourrait justifier soit une vue 2D contextuelle premium (intégrée dans S-PIM-VISUELS-1 biblio Magrit), soit une vue 3D limitée à 1-2 produits spécifiques (PLV dibond) ? Réponse conditionne si on doit prévoir une story **complémentaire** S-PRODUCT-VIEWS-CONTEXT-PLV (vue contextuelle 2D ou hybride) **après** S-PRODUCT-VIEWS-MULTI.

**Si tes réponses sont :** Q-ROADMAP = print plat / Q-SIGNAL = aucun / Q-SCOPE-PLV = 2D contextuel premium suffit → **Option A confirmée sans réserve, story Sprint 7, ~2-3j.**

**Si une seule réponse bascule** (packaging confirmé court terme, ou signal client explicite, ou demande PLV 3D dédiée) → on rouvre le débat avec une option C hybride (2D principal + 3D ciblée PLV uniquement, ~5j hors modélisation).

---

## Fichiers de référence

- [supabase/functions/mockup-generator/index.ts](../../supabase/functions/mockup-generator/index.ts) — edge function actuelle, point d'extension naturel option A
- [supabase/functions/_shared/mockup/](../../supabase/functions/_shared/mockup/) — pipeline resvg-wasm + templates
- [src/app/components/mockup/MockupImage.tsx](../../src/app/components/mockup/MockupImage.tsx) — composant front, point d'extension UI carrousel option A
- [story-S-PIM-VISUELS overview](../implementation-artifacts/story-S-PIM-VISUELS-gabarits-fond-personnalisable.md) — composition 3 layers shop-scoped Sprint 7, compatibilité native A
- [architecture.md §4.3](architecture.md) — Mockup Engine architecture (ligne 300-329)
- [roadmap qualité-first](roadmap-v1.1-qualite-first-2026-05-21.md) — Sprint 7 cible S-PRODUCT-VIEWS-MULTI
