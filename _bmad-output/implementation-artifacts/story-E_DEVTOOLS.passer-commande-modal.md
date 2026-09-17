---
id: E_DEVTOOLS.passer-commande-modal
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/35dd0131973c81efab27d17bf7799745
---
# E_DEVTOOLS.passer-commande-modal — Remplacer confirm() native par AlertDialog shadcn

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E_DEVTOOLS.passer-commande-modal — Remplacer confirm() native par AlertDialog shadcn](https://app.notion.com/p/35dd0131973c81efab27d17bf7799745) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 4 | P1 | S | Pas commencé | Claude code | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Campagne TF Sprint 3 du 11/05 — TF-62 OK partiel (empty state OK mais flow `Passer commande` gèle renderer ≥ 45 s).

- Fiche TF : [TF-62](https://www.notion.so/35dd0131973c81b0ae26f1eaa9474a98)
- CR : [CR 11/05](https://www.notion.so/35dd0131973c8107bf9ad735ab8c5353)

##### Contexte

Flow `Passer commande` depuis drawer panier B2B → renderer figé 45 s + retry navigation timeout. Suspicion forte : popup `confirm()` native qui bloque l'extension Claude in Chrome jusqu'à intervention humaine. La popup native bloque la boucle d'événements JS, non interceptable par CDP.

Impact : impossible de jouer en automation IA Chrome la création de commande + le résultat avec rows peuplées de TF-62. Validation shop_orders end-to-end bloquée.

Périmètre : [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) (méthode `submitCart` l. 254-300, voir aussi appels `alert()` et `confirm()`).

##### User story

En tant que Acheteur shop_only (humain ET IA Chrome), je veux que la confirmation de passage de commande utilise un dialog modal shadcn ouvert/fermé via clics standards, afin de pouvoir valider ma commande en automation testable et obtenir une UX cohérente.

##### Critères d'acceptation

1. **Given** drawer panier avec ≥ 1 article + email customer, **When** je clique `Passer commande`, **Then** un AlertDialog shadcn ouvre : titre `"Confirmer la commande"`, description (nb articles, total TTC), bouton `Annuler`, bouton `Confirmer`.
2. **Given** AlertDialog ouvert, **When** clique `Annuler`, **Then** dialog ferme + **aucun INSERT shop_orders** exécuté.
3. **Given** AlertDialog ouvert, **When** clique `Confirmer`, **Then** INSERT `shop_orders` s'exécute, dialog ferme, toast succès, bascule vers `/orders`.
4. **Given** Claude in Chrome MCP, **When** joue le flow via `javascript_tool` + `click()`, **Then** **aucun freeze 45 s**, renderer responsive, `shop-orders-list` se peuple.
5. **0 régression** : bouton `Vider le panier` fonctionnel (si autre `confirm()`, migrer même story).
6. **a11y** : AlertDialog respecte `role="alertdialog"` + `aria-modal="true"` + focus trap initial.
7. **Re-test TF-62** bascule en OK complet (rows peuplées testables IA Chrome).

##### Spécifications

- Fichier : [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) méthode `submitCart`. Remplacer `confirm()` par state-driven `useState` `showConfirm` + render conditionnel `<AlertDialog>`.
- Composant : `@radix-ui/react-alert-dialog` (déjà installé). Tags `<AlertDialog>` + `<AlertDialogContent>` + `<AlertDialogHeader>` + `<AlertDialogTitle>` + `<AlertDialogDescription>` + `<AlertDialogFooter>` + `<AlertDialogCancel>` + `<AlertDialogAction>`.
- Toast : `sonner` (déjà installé) pour remplacer `alert()` (l. 291, 297) si l'occasion s'y prête — sinon hors scope (story dédiée).
- Pas d'endpoint backend ajouté.
- **testids à déclarer dans **[**src/app/lib/testIds.ts**](src/app/lib/testIds.ts) (PAS en dur) : `shop-passer-commande-dialog`, `shop-passer-commande-dialog-cancel`, `shop-passer-commande-dialog-confirm`.

##### Dépendances

- Aucun prérequis bloquant.
- Couplable optionnellement avec migration `alert()` → `sonner` (out of scope ici).

##### Estimation

**S (\< 1 j)**. State + AlertDialog + 3 testids + test vitest + re-test TF-62. 3-4 h.

##### Plan de test

- TF à re-jouer : [TF-62](https://www.notion.so/35dd0131973c81b0ae26f1eaa9474a98) end-to-end avec création commande via UI puis vérification rows.
- TF nouveau : *"Drawer panier — Passer commande via AlertDialog shadcn testable IA Chrome"*, P09, Acheteur shop_only, P0, Manuel + IA Chrome.
- Smoke vitest : rendu conditionnel AlertDialog + simulate click cancel + confirm + assertion INSERT mock.

##### Définition de « terminé »

- Code mergé sur `beta/v5`.
- 3 nouveaux testids déclarés dans [src/app/lib/testIds.ts](src/app/lib/testIds.ts).
- vitest 162/162+ verts.
- Re-test TF-62 OK complet (rows peuplées testables IA Chrome).
- TF nouveau créé et OK.
- CR campagne suivante mentionnant la levée de la dette.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E_DEVTOOLS.passer-commande-modal

_Aucun fichier du dépôt ne cite cet identifiant._
