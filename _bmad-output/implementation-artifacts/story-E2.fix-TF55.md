---
id: E2.fix-TF55
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/35dd0131973c8123a074d5922f8d4bcd
---
# E2.fix-TF55 — ShopLayout applique data-theme="dark" par défaut

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E2.fix-TF55 — ShopLayout applique data-theme="dark" par défaut](https://app.notion.com/p/35dd0131973c8123a074d5922f8d4bcd) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 4 | P0 | XS | Pas commencé | Claude code | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Story de correctif issue de la **Campagne TF Sprint 3 du 11/05/2026** — cas TF-55 ❌ KO P0.

- Fiche TF source : [TF-55 — ShopLayout 1-col header brandé + dark mode actif par défaut](https://www.notion.so/35dd0131973c811e9a86c38872fcecde)
- CR campagne : [CR Campagne TF — Sprint 3 — 11/05/2026](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

##### Contexte

Sur `/shop/xyfjjo-q6kekm` viewport 1440×900 : `document.documentElement.getAttribute('data-theme')=null`, `body=null`, `shop-portal=null`. `querySelectorAll('[data-theme="dark"]').length=0`. Aucune classe `.dark`. Background body `rgb(255,255,255)`, shop-portal `rgb(250,250,250)` — light mode rendu.

Tous les autres critères TF-55 sont OK : shop-portal présent, shop-header sticky brandé « ERAM × Magrit », nav locale, cart icon, user menu, 4 pills + pill-all, variables CSS `--shop-primary=#1e3a8a` et `--shop-accent=#f59e0b` injectées.

Spec B5 : dark mode = comportement par défaut du shop B2B (pas un toggle utilisateur).

Périmètre : [src/app/components/shop/ShopLayout.tsx](src/app/components/shop/ShopLayout.tsx) (373 lignes).

##### User story

En tant que **Visiteur non authentifié**, je veux que la boutique B2B s'affiche en dark mode par défaut, afin de bénéficier de l'expérience visuelle validée par S2.1 / S-REWORK-1 (cohérence avec le branding tenant).

##### Critères d'acceptation

1. **Given** je navigue `/shop/<slug-actif>`, **When** la page est montée, **Then** `document.querySelector('[data-testid="shop-portal"]').getAttribute('data-theme')` retourne exactement **`"dark"`**.
2. **Given** dark mode appliqué, **When** j'inspecte le computed background, **Then** body et shop-portal résolvent sur des couleurs sombres conformes aux tokens `bg-bg`/`text-ink`/`bg-paper`/`text-paper` en contexte dark.
3. **Given** tenant configuré `primaryColor="#1e3a8a"` et `accentColor="#f59e0b"`, **When** la boutique est rendue en dark, **Then** les variables CSS `--shop-primary` et `--shop-accent` restent injectées et visibles sur mockups + badges + header logo.
4. **Given** Tab clavier, **When** je traverse les éléments interactifs, **Then** focus ring 2 px accent visible (dark-mode-safe).
5. **0 régression** : TF-56 access guard, TF-57 pills, TF-63 drawer restent OK — vérifier qu'aucun token Tailwind ne casse en dark.
6. **Re-test TF-55** bascule en OK sur prochaine campagne.

##### Spécifications API / data

- **Fichier cible** : [src/app/components/shop/ShopLayout.tsx](src/app/components/shop/ShopLayout.tsx) — ajouter `data-theme="dark"` sur le wrapper racine `shop-portal` (attribut JSX statique).
- Pas d'endpoint, pas de SQL, pas de featureFlag.
- `shop-portal` déjà dans [src/app/lib/testIds.ts](src/app/lib/testIds.ts).
- Vérifier résolution dark des tokens (tailwind.config ou variables CSS globales).

##### Dépendances

- Aucun prérequis bloquant. Peut être joué en parallèle de `E_ROOT.fix-PublicShop-hooks` (séquencement J3-J4).

##### Estimation

**XS (\< 2 h)**. Ajout attribut JSX statique + audit visuel tokens dark.

##### Plan de test

- **TF existant à re-jouer** : [TF-55](https://www.notion.so/35dd0131973c811e9a86c38872fcecde).
- **Smoke vitest** : snapshot ou DOM assertion `shop-portal[data-theme="dark"]` dans `ShopLayout.helpers.test.ts`.
- **Vérification visuelle** : smoke humain sur port 5177 sur les 4 vues (Accueil / Catalogue / Mes commandes / Drawer).

##### Définition de « terminé »

- Code mergé sur `beta/v5`.
- vitest 162/162 verts.
- Re-test TF-55 OK tracé.
- Smoke visuel Arnaud validé.
- CR campagne suivante mentionnant KO → OK.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E2.fix-TF55

_Aucun fichier du dépôt ne cite cet identifiant._
