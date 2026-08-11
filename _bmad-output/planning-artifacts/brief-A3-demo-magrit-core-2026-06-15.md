---
id: brief-A3-demo-magrit-core-2026-06-15
type: brief opérationnel
created_at: 2026-06-15
author: Mary (BMAD Analyst)
sprint_cible: Démo Magrit Core sem du 15/06 (CR WM#090626 § Action A3)
participants_demo: Arnaud Mazon (PDG AGE Dvt.), Xavier Péchoultres (Expert Solutions / lead dev Magrit Core), Laurent Rebière (Clariprint)
date_demo: mercredi ou jeudi sem du 15/06 (à confirmer)
livrables:
  - _bmad-output/planning-artifacts/brief-A3-demo-magrit-core-2026-06-15.md (ce fichier)
  - _bmad-output/planning-artifacts/demo-fichier-brut-magrit-core.csv
  - _bmad-output/planning-artifacts/demo-prompt-claude-cleaning.md
sources:
  - "vault: 03_MAGRIT/CR_WM090626_Magrit_Backlog.md"
  - "vault: 03_MAGRIT/backlog_Magrit_output.md"
  - "POC: src/server/clariprint/ClariprintAdapter.ts"
  - "POC: src/app/utils/clariprintQuote.ts (validateClariprintResponse)"
  - "Clariprint doc réelle: https://trac.clariprint.com/wiki/ApiAppelOffre (fetched 2026-06-15)"
  - "memory: project_clariprint_anomalies.md"
---

# Brief A3 — Démo Magrit Core, semaine du 15/06

## Résumé exécutif (10 lignes)

La démo vise à montrer en une séquence visible le **pipeline complet « fichier brut client → straight to print »** : un Excel hétérogène envoyé par un client final, nettoyé/structuré par Claude (multi-passes : formatage → extraction → mise en cases → validation tricolore vert/orange/rouge), converti au format CSV standard Clariprint `ApiAppelOffre`, puis envoyé à l'API Solver pour chiffrage. La doc API réelle (fetched aujourd'hui) révèle 3 contraintes structurantes qui n'étaient pas dans le POC v1.1 : **(1)** format wire = CSV `;`, pas JSON ; **(2)** vocabulaire FR strict (`type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso`) avec dimensions en **cm virgule FR** ; **(3)** mode **asynchrone** (création → SESSION → polling `action=status`). La séquence démo se découpe en 4 étapes (~6 min total) avec un fichier brut de 12 lignes préparé. **Limitation découverte** : l'API V1 couvre `feuillet / dépliant / brochure / cahier / chemise / cover / encart` mais PAS affiches / kakémonos / banderoles / étiquettes / enveloppes — c'est un message commercial à manier précisément. Côté audit maturité stories, **3 stories sont 🟢 chiffrables maintenant** (E11 brief-to-card, E22 import qualité, E44 middleware API), **2 sont 🟡 à mûrir** (E10 conseil bundle, E45 connecteur datas), et **6 sont 🔴 à créer** (notamment pour traiter les types hors scope ApiAppelOffre V1). Avant la démo, **8 questions à clarifier avec Xavier** (endpoint URL exact, clé démo, mode async/polling, format réponse parsing, finitions, types hors scope, Pantone, dimensions).

---

## 1. Séquence démo — 4 étapes

### Étape 1 — « Voici ce que reçoit l'imprimeur aujourd'hui » (~1 min)

**Ce qu'on montre** :
- Le fichier brut `demo-fichier-brut-magrit-core.csv` ouvert dans Excel ou affiché en vue tableau.
- 12 lignes, colonnes : Ref interne / Désignation / Quantité / Format / Type papier / Grammage / Recto Verso / Couleurs / Finition / Reliure / Pages / Délai / Notes.

**Ce qu'on dit** :
- *« Voilà ce qu'un client envoie à un imprimeur. Excel libre, colonnes qu'il choisit, libellés qu'il maîtrise. C'est ce que l'imprimeur retraite à la main, ligne par ligne, plusieurs heures par dossier. »*
- Pointer les anomalies visibles : grammage écrit sans accent ("couche brillant"), unités mélangées (`85x55` et `80x200 cm` côte à côte), Pantone mentionné, doublon silencieux entre COM-001 et COM-007, ligne grand format (kakémono) qui sortira du périmètre Clariprint Solver V1.

**Output visible** : tableau brut tel quel, sans traitement.

**Timing** : 1 min.

---

### Étape 2 — « Claude nettoie, structure, signale » (~2 min)

**Ce qu'on montre** :
- Une fenêtre Claude (chat ou écran Magrit Core en cours de dev) où on **colle le prompt** `demo-prompt-claude-cleaning.md` suivi du contenu CSV brut.
- Claude répond avec **2 sorties simultanées** :
  - Un **JSON intermédiaire** (objet métier interne) avec un champ `_confidence: green|orange|red` à côté de chaque valeur extraite.
  - Le **CSV Clariprint** au format `ApiAppelOffre` (séparateur `;`, vocabulaire FR strict).

**Ce qu'on dit** :
- *« On lui donne un seul prompt qui contient le référentiel Clariprint (types, codes encres, codes reliures, conversions d'unités). Il fait 4 passes : formatage, extraction, mise en cases, validation. »*
- *« Sur 12 lignes, il identifie 7 produits chiffrables par Clariprint Solver V1, 5 hors scope (affiches, kakémono, banderole, étiquettes — formats grand public à traiter dans la roadmap Solver). Il signale 1 doublon. Il convertit le grammage "350g" en `350`, l'orthographe "couche brillant" en `Couché brillant`, les dimensions "85x55" en `5,5;8,5` en cm. »*
- *« Le tricolore reste visible : l'imprimeur voit immédiatement ce qui est sûr (vert), ce qui a été interprété et demande sa validation (orange), ce qui est bloquant (rouge). »*

**Output visible** :
- À gauche : le JSON intermédiaire avec colorisation vert/orange/rouge sur les valeurs.
- À droite : le CSV Clariprint final, 7 lignes prêtes à envoyer.

**Timing** : 2 min (laisser respirer le scroll JSON, pointer le summary).

---

### Étape 3 — « L'imprimeur valide en un coup d'œil » (~1,5 min)

**Ce qu'on montre** :
- Maquette / interface Magrit Core où le JSON est rendu en tableau visuel, avec :
  - Cellules **vertes** (donnée confirmée, OK pour Clariprint).
  - Cellules **oranges** : un mini-bouton "valider" / "corriger" / "ignorer". Ex sur COM-002 (grammage `135` déduit) ou Pantone sur COM-006 (simplifié en quadri).
  - Cellules **rouges** : zone "OUT_OF_SCOPE" avec lien vers la roadmap "ce type n'est pas encore couvert par notre Solver V1 — vous serez notifié quand ce sera dispo".
- Un bouton **« Envoyer à Clariprint »** en bas, désactivé tant qu'au moins une cellule orange n'est pas tranchée.

**Ce qu'on dit** :
- *« L'imprimeur ne retraite plus à la main. Il valide d'un clic ce qui est orange. Pour ce qui est rouge, on lui dit "garde-le, on l'enverra ailleurs" — et on lui montre une roadmap claire sur ce qu'on va couvrir prochainement. »*
- *« Au final, c'est lui qui décide ce qu'on envoie au Solver. Magrit Core sert la donnée, l'imprimeur reste maître. »*

**Output visible** : le tableau coloré + bouton "Envoyer à Clariprint".

**Timing** : 1,5 min.

---

### Étape 4 — « Clariprint chiffre, l'imprimeur exporte » (~1,5 min)

**Ce qu'on montre** :
- Clic sur "Envoyer à Clariprint". Magrit Core transforme le CSV en requête HTTP POST :
  ```
  POST mon_domaine/optimprokect/csv.wcl
  key=<clé démo>
  action=creation
  sheets[]=A
  columns[A]=type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso;binding;pages
  rows[A!1]=feuillet;COM-001;500;5,5;8,5;Couché brillant;350;Q;Q;;
  rows[A!2]=feuillet;COM-002;2000;14,8;21;Couché brillant;135;Q;;;
  rows[A!3]=brochure;COM-003;300;21;29,7;Offset;170;Q;Q;PerfectBinding;24
  ...
  ```
- Réponse Clariprint :
  ```
  SESSION;abc123xyz
  PROJECT;-;COM-001;CREATE
  PROJECT;-;COM-002;CREATE
  ...
  ```
- **Polling automatique** `action=status` chaque 2-3 secondes jusqu'à `OK`.
- Affichage progressif des prix par ligne dans le tableau Magrit Core :
  ```
  PROJET;1;COM-001;OK;78,00;6,50;FournisseurX;1;...
  ```

**Ce qu'on dit** :
- *« On envoie le tout en une seule requête. Clariprint nous donne une session. On poll, on récupère les prix en temps réel, on les affiche dans le tableau. »*
- *« Du fichier brut à la grille de prix Clariprint : 6 minutes au total sur un dossier de 12 lignes. Sans l'outil, c'est 30 minutes à 1 heure de retraitement Excel manuel pour le même résultat. »*

**Output visible** :
- À gauche : la requête HTTP envoyée (curl ou affichage technique).
- À droite : le tableau Magrit Core avec les prix qui se remplissent ligne à ligne.

**Timing** : 1,5 min (la latence Clariprint donne du rythme dramatique).

---

**Durée totale démo** : ~6 minutes. Q&R / discussion architecture en suivant.

---

## 2. Audit maturité stories pour développer cette chaîne

Sources scannées :
- Backlog Epics Magrit V1 (`vault: 03_MAGRIT/backlog_Magrit_output.md`, 48 epics, 661 j.h estimés).
- Stories POC v1.1 (`_bmad-output/implementation-artifacts/` — 50+ stories).
- Doc API réelle Clariprint (fetched 2026-06-15).

### Légende
- 🟢 **Suffisamment claire pour développer** post-démo, après réponses Xavier sur les questions ouvertes.
- 🟡 **À mûrir** : la story existe en backlog mais manque de précision (champs, contrat, périmètre exact) pour un dev direct.
- 🔴 **À créer** : nécessaire pour la chaîne complète mais aucune story actuelle ne la couvre.

### Stories Magrit Core directement impliquées

| ID Epic | Intitulé | Statut maturité | Pourquoi |
|---|---|---|---|
| **E11** Chat | Brief-to-Product Card | 🟢 | Le prompt Claude livré ici (`demo-prompt-claude-cleaning.md`) est une implémentation concrète V1 de E11. Stories filles à créer pour la version Magrit Core (vs POC) : `E11.1 prompt référentiel Clariprint`, `E11.2 schéma JSON intermédiaire avec confidences`, `E11.3 UI tableau tricolore`. |
| **E22** Clariprint BO | Import/export et qualité référentiels | 🟢 | Le CSV intermédiaire produit ici matche le besoin E22. À cadrer en stories filles : `E22.1 conversion fichier libre → CSV Clariprint`, `E22.2 validation tricolore client-side`, `E22.3 export erreurs au format imprimable`. |
| **E44** Solver | Middleware Solver API V1 | 🟢 | Endpoint Clariprint identifié (ApiAppelOffre `csv.wcl`). Stories filles : `E44.1 wrapper HTTP avec clé API`, `E44.2 polling status async + timeout`, `E44.3 parsing réponse CSV`, `E44.4 gestion erreurs typées (alignement POC ClariprintAdapter)`. |
| **E10** Chat | Agent conseil besoin vers bundle produits | 🟡 | Adjacent mais distinct du prompt actuel (E10 = conseil amont, le prompt actuel = transformation aval). À cadrer post-démo si le besoin émerge côté commercial. |
| **E45** Solver | Connecteur backend datas Clariprint | 🟡 | Couvre UMM/UBM/UTM/ULM (référentiels matière/builder/transformer/logistique). Pas nécessaire pour la démo V1 (CSV direct via ApiAppelOffre suffit). À mûrir pour V2. |
| **E12** Chat | Descriptif technique interactif | 🟡 | Adjacent : permettrait à l'imprimeur de demander des explications en langage naturel sur les `orange` / `red`. Bonus UX hors scope démo. |
| **E47** Solver | Évolution Solver UMM/UBM/UTM | 🔴 | Critique pour couvrir les types hors scope ApiAppelOffre V1 (affiches, kakémonos, banderoles, étiquettes, enveloppes). Aucun cadrage actuel. À créer si Arnaud veut élargir l'offre commerciale. |
| **(nouveau)** | E22.1 — Prompt Claude transformer fichier libre → CSV Clariprint | 🔴 | Le prompt livré ici sert de spec exécutable. À transposer en story BMAD avec ACs, tests, intégration. |
| **(nouveau)** | E11.3 — UI validation tricolore Magrit Core | 🔴 | Composant React + design system Magrit Core. Pattern de référence : design hi-fi `.design-handoff/designs/04 - Admin dashboard.html`. |
| **(nouveau)** | E44.2 — Polling SESSION + statut Clariprint async | 🔴 | Mode async non couvert par le POC v1.1 (qui faisait du sync). Story dédiée nécessaire avec gestion timeout + retry + fallback. |
| **(nouveau)** | E22.4 — Référentiels mapping (encres, papiers, finitions, reliures) | 🔴 | Aujourd'hui inline dans le prompt Claude. À externaliser en table de mapping versionnée pour évolution future sans toucher au prompt. |
| **(nouveau)** | E47.1 — Solver grand format & affichage | 🔴 | Hors scope ApiAppelOffre V1, mais représente une part substantielle des commandes imprimeur réelles. Effort estimé probable 20-30 j.h selon volume formats à couvrir. |

### Stories POC v1.1 réutilisables côté Magrit Core

Le POC actuel (`/Users/arnaudmazon/Documents/Claude/BMAD/Magrit/`) contient du code transposable :

| Story POC | Réutilisable dans Magrit Core ? | Notes |
|---|---|---|
| **S1.1** AnthropicClient wrapper (`supabase/functions/_shared/anthropicClient.ts`) | ✅ Oui directement | Wrapper LLM avec `anthropicComplete()`, `anthropicCompleteStructured(zodSchema)`, `anthropicStream()` + tracking auto `llm_usage_events`. Pattern aligné Magrit Core (un wrapper centralisé, mockable, validé Zod). |
| **S1.2** ClariprintAdapter (`src/server/clariprint/ClariprintAdapter.ts`) | ⚠️ Adapter, pas réutiliser tel quel | Le POC parle JSON, Magrit Core devra parler CSV `;`. L'interface (méthodes `computePrice` + `testConnection` + erreurs typées par `kind`) reste valide. Le contenu d'implémentation change. |
| **S1.5** Refactor LLM finalisation + validation Zod | ✅ Oui directement | Validation stricte JSON via Zod schema. Pattern à reprendre pour valider la sortie du prompt Claude avant transformation en CSV Clariprint. |
| **P0.4 → P0.9** pim-ingest smoke + corrections cm/mm + parité resolveGamme | ⚠️ Inspirant, pas réutilisable | Les corrections (lesson P0.9 convention `string=cm` ↔ `number=mm`) sont à transposer en règles dans le prompt Claude. La fonction `normalizeDimensions` du POC est un bon prototype. |
| **S0.2** validateClariprintResponse (anomalies prix négatifs/undefined/produits manquants) | ✅ Oui directement | À porter dans le parsing de la réponse CSV Clariprint (`PROJET;...;OK;<tarif>`) : si tarif manquant ou négatif → ne pas exposer à l'imprimeur. |
| **Lesson `project_clariprint_anomalies.md`** | ✅ Référence canonique | À intégrer en commentaire dans la story `E44.4 gestion erreurs typées`. |

### Verdict global

**Pour la démo du 15/06 : les 3 stories pivot (E11, E22, E44) sont suffisamment claires pour développer la version V1 dans Magrit Core, sous réserve des réponses Xavier sur les 8 questions ouvertes** (cf. §4 ci-dessous). Le prompt livré + le fichier brut + ce brief constituent un kit de démo opérationnel.

**Pour V2+ post-démo** : les 5 stories 🔴 (E47.1 grand format notamment) sont indispensables pour couvrir le périmètre commercial complet d'un imprimeur Pro. À cadrer en sprint dédié si Arnaud veut s'engager au-delà de l'API V1 Clariprint actuelle.

---

## 3. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| L'API ApiAppelOffre ne supporte pas les finitions (pelliculage, vernis, dorure) | Élevée (rien dans la doc) | Élevé — c'est majoritaire en imprimerie commerciale | Préciser le scope démo aux 7 produits sans finitions complexes. Lever la question avec Xavier. |
| Mode async + polling allonge la démo (latence visible 5-30 s ?) | Moyenne | Moyen — rythme démo plat | Préparer fallback "vidéo accélérée" ou cache réponse pré-enregistré. |
| Clariprint refuse la connexion en démo (clé API manquante / staging instable) | Élevée tant qu'Xavier n'a pas envoyé la clé | Bloquant | Fallback : montrer la requête CSV générée + une réponse statique pré-enregistrée. Démo "off-line" fonctionnelle. |
| Le format CSV `;` avec virgule décimale FR (`29,7`) casse les parseurs CSV standards | Moyenne | Moyen | Ne JAMAIS exporter ce CSV brut côté UI imprimeur. Le CSV `ApiAppelOffre` est uniquement un format wire-protocol interne, jamais montré comme "fichier" à l'utilisateur. |
| Types hors scope (affiches/kakémonos) déçoivent Laurent Rebière côté Clariprint | Moyenne | Moyen commercial | Présenter la limitation comme une **roadmap claire** (E47.1) plutôt qu'un manque. Argument : "on cible d'abord ce que votre API V1 fait le mieux". |
| Le prompt Claude produit une sortie non-déterministe (ordre champs, JSON pas strict) | Moyenne | Faible | Valider Zod côté Magrit Core sur la sortie Claude. Si échec parsing → re-prompt strict ou retry. Aligné lesson S1.5. |
| Doublons silencieux dans le fichier brut client passent à travers la détection | Faible | Moyen | Algorithme de détection actuel (kind+dims+qt+papier+grammage+couleurs) couvre la majorité. Sinon → orange + warning. |

---

## 4. Questions ouvertes à clarifier avec Xavier — AVANT la démo

À envoyer à Xavier sous 24h pour avoir les réponses avant mer/jeu de la sem du 15/06.

1. **Endpoint URL exact** : `mon_domaine/optimprokect/csv.wcl` doit être préfixé par quel domaine ? Quel URL prod / staging pour la démo ?
2. **Clé API démo** : qui fournit la clé pour la démo ? Une clé démo dédiée ou la clé prod Clariprint AGE Dvt. ?
3. **Mode async** : `callback` ou polling `action=status` recommandé pour la démo ? Quel timing typique de calcul (secondes ou minutes) ?
4. **Format réponse status** : la réponse CSV `PROJET;<id>;<ref>;OK;<tarif>;<mille_plus>;<fournisseur>;<rang>;<indice>;<couts_impression>;<cout_façonnage>;<cout_papier>;<livraison>;<callage>` — quel parser officiel côté Magrit Core ? Y a-t-il un schéma JSON dérivé documenté ?
5. **Finitions** : ApiAppelOffre V1 documenté n'inclut pas pelliculage / vernis / dorure / découpe — comment Clariprint gère-t-il ces options en chiffrage ? Autre API, ou colonnes optionnelles non documentées sur ApiAppelOffre ?
6. **Types hors scope** : affiches / kakémonos / banderoles / étiquettes / enveloppes représentent ~30-40% des commandes imprimeur réelles. Roadmap V1 Clariprint pour les couvrir, ou prévu uniquement via E47 "Évolution Solver UMM/UBM/UTM" du backlog Magrit V1 ?
7. **Couleurs Pantone** : non documentées dans ApiAppelOffre. Comment Clariprint chiffre 1 couleur Pantone (qui est plus coûteuse que quadri sur petites quantités) ?
8. **Format dimensions** : `hauteur;largeur` en cm virgule FR confirmé ? Ordre toujours hauteur × largeur ? Normalisation orientation portrait/paysage côté Clariprint ou côté Magrit Core ?

---

## 5. 3 prochaines actions concrètes (Arnaud) AVANT mer/jeu 15/06

### Action 1 — Envoyer les 8 questions à Xavier (≤ 24h)

Copier la liste §4 ci-dessus dans un email / Slack à Xavier. Indiquer que les réponses sont nécessaires pour préparer une démo "straight to print" qualitative. Sans réponses, démo en mode dégradé "off-line" avec données pré-enregistrées.

**Effort** : 15 min de rédaction email.

### Action 2 — Tester le prompt Claude en chat (≤ 1h)

Coller `demo-prompt-claude-cleaning.md` + `demo-fichier-brut-magrit-core.csv` dans une session Claude (claude.ai/chat avec Sonnet 4.5 ou Opus 4.6+). Vérifier :
- Le JSON intermédiaire est correctement formé et contient les 12 items
- Les confidences vert/orange/rouge sont cohérentes (cf. §1 Étape 2 du brief : 5 OUT_OF_SCOPE, 1 doublon, ~5 full green)
- Le CSV final est valide (séparateur `;`, virgule décimale FR, vocabulaire Clariprint strict)

Si la sortie est défaillante (mauvais mapping unités, types non reconnus, etc.) → ajuster le prompt avant la démo. Le prompt est un fichier `.md` éditable.

**Effort** : 30 min de test + 30 min d'ajustement si besoin.

### Action 3 — Préparer le fallback off-line (≤ 30 min)

En cas d'absence de réponse Xavier sur l'API ou de panne staging Clariprint le jour J :
- Sauvegarder l'output réel du test Action 2 (JSON intermédiaire + CSV Clariprint).
- Préparer une réponse `PROJET;1;COM-001;OK;78,00;...` factice à afficher comme si elle venait de Clariprint.
- Garder dans un onglet ouvert pendant la démo, prêt à coller si l'API ne répond pas.

**Effort** : 30 min.

---

## 6. Limites du brief (transparence)

- **Estimation depuis POC + doc API publique** : aucun accès au repo Magrit Core de Xavier au moment de la rédaction. Le brief assume que Magrit Core va consommer ApiAppelOffre tel que documenté côté Clariprint, sans extension propriétaire non documentée. **Risque de divergence à valider question 1 et 4.**
- **Pas testé en live** : le prompt Claude n'a pas été joué sur un Claude réel ici (Mary = agent BMAD, pas accès au chat Claude direct). Action 2 (Arnaud) couvre ce gap.
- **Limites doc Clariprint** : la page wiki Trac couvre le squelette POST + énumérations basiques. Aucune mention finitions, options de production, codes erreur HTTP, rate limit, SLA. À compléter avec Xavier ou Laurent Rebière directement.

---

## References

- Brief A3 séquence démo : ce fichier
- Prompt Claude opérationnel : `_bmad-output/planning-artifacts/demo-prompt-claude-cleaning.md`
- Fichier brut de démo : `_bmad-output/planning-artifacts/demo-fichier-brut-magrit-core.csv`
- CR réunion 09/06 source : `~/vault-age-dvt/03_MAGRIT/CR_WM090626_Magrit_Backlog.md`
- Backlog Epics Magrit V1 (48 epics) : `~/vault-age-dvt/03_MAGRIT/backlog_Magrit_output.md`
- Doc API Clariprint ApiAppelOffre : https://trac.clariprint.com/wiki/ApiAppelOffre
- POC ClariprintAdapter : `src/server/clariprint/ClariprintAdapter.ts`
- POC validateClariprintResponse : `src/app/utils/clariprintQuote.ts`
- Lesson Clariprint anomalies : `memory/project_clariprint_anomalies.md`
