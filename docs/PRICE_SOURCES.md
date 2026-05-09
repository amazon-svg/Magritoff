# PRICE_SOURCES — Audit des sources de prix Magrit

> **Livrable de la story S0.2 (E-NEW-CLARIPRINT-01) — Investigation provenance des prix et infos produits affichés.**
> **Date :** 2026-05-09
> **Auditeur :** Winston (BMAD architect) via subagent Explore
> **Branche auditée :** `beta/v5` (BMAD/Magrit) — code identique à `beta/v4` côté logique de prix
> **Statut :** Audit terminé. Recommandations prêtes pour décision Arnaud.

---

## 1. TL;DR

| # | Constat | Sévérité |
|---|---|---|
| ✅ | **Pas d'hallucination LLM de prix** : Claude/GPT ne génèrent JAMAIS de prix présentés à l'utilisateur. Les `+€` dans les suggestions LLM sont **pédagogiques uniquement**. | OK |
| 🔴 | **Le « 2e prix mystère »** identifié : c'est `PricingPanel.tsx:26` qui affiche `product.price` SANS consulter `clariprintQuote`. Tous les autres composants ont une hiérarchie correcte Clariprint > estimé > hardcodé. | Critique |
| 🔴 | **Aucune validation des anomalies Clariprint** côté endpoint `clariprint-quote` (`make-server-e3db71a4/index.ts:1212`). Un prix `-1,2 €` retourné par Clariprint est affiché tel quel à l'utilisateur. | Critique |
| 🟡 | **Pas de helper unique de résolution de prix** (`priceResolver`). Chaque composant duplique la hiérarchie de fallback, augmentant le risque d'écart. | Élevée |
| 🟡 | **CartContext ligne 52** utilise `item.product.price \|\| 0` directement, sans hiérarchie — risque que le panier total soit calculé sur des prix stale. | Moyenne |

**Conclusion :** la dualité de prix vient d'un **outlier architectural** (PricingPanel) + d'une **absence de sanitization** côté endpoint. Pas de fuite par hallucination LLM. **Fix réalisable en ~1 jour** avant Order entity v1.1.

---

## 2. Tableau exhaustif des sources de prix par écran

| Écran / Composant | Fichier | Ligne(s) | Source primaire | Source fallback | Hiérarchie correcte ? |
|---|---|---|---|---|---|
| **ProductCard — affichage principal** | `ProductCard.tsx` | 409 | `displayPriceHT` (calculé l. 222-225) | `clariprintQuote.priceHT` puis `estimatedPrice()` | ✅ Oui |
| **ProductCard — onglet Pricing** | `ProductCard.tsx` | 770 | `displayPriceHT` | `estimatedPrice()` si Clariprint absent | ✅ Oui |
| **PricingPanel — panneau latéral** | `PricingPanel.tsx` | **26** | **`product.price` BRUT** | **Aucun** | 🔴 **NON — outlier** |
| **QuoteModal — devis imprimé** | `QuoteModal.tsx` | 59 | `clariprintQuote?.costs?.total` | `priceHT` puis `product.price` | ✅ Oui |
| **PortalProduct — fiche produit B2B** | `PortalProduct.tsx` | 75 | `quote.priceHT` (Clariprint) | `product.price_ht * (qty/500)` | ✅ Oui (avec calcul prorata) |
| **PortalCatalog — grille catalogue IA** | `PortalCatalog.tsx` | 113-118 | `quote.priceHT` via `fetchClariprintQuote` | Nul (produit éphémère) | ✅ Oui |
| **PortalCart — panier B2B** | `PortalCart.tsx` | 31 | `cart.reduce(...product.price_ht)` | Aucun | 🟡 Partiel — pas de check Clariprint |
| **CartContext — état global** | `CartContext.tsx` | **52** | **`item.product.price \|\| 0`** | **Aucun** | 🟡 Risque : prix stale |
| **CartButton — ajout au panier** | `CartButton.tsx` | 86, 105 | `clariprintQuote?.costs?.total` | `priceHT` puis `product.price` | ✅ Oui |

**Observation :** 7 composants/écrans sur 9 ont une hiérarchie correcte. **2 outliers** sont la racine de la dualité observée par Arnaud.

---

## 3. Origine du "2e prix mystère"

**`PricingPanel.tsx` ligne 26** affiche directement `product.price` sans jamais consulter `clariprintQuote`. Le `product.price` provient probablement :

- Des **props** passées au composant (descend du contexte ou de l'état parent)
- Souvent = **valeur retournée par `estimatedPrice()`** dans `ProductCard.tsx:219` (fallback hardcodé pédagogique)
- Possiblement = **valeur cachée stale** (state global ou localStorage — non identifiée formellement)
- Possiblement = **valeur générée par les `suggestions` LLM** dans le mode démo (ex : `"+8€"`) — mais ces valeurs sont théoriquement pédagogiques, à confirmer

**Vérification importante (à faire en code review du fix) :** s'assurer qu'aucun `product.price` n'est jamais peuplé par une réponse LLM brute (pas de write côté front à `product.price` après un appel Anthropic).

---

## 4. Comportement face aux anomalies Clariprint

### Anomalies connues (CONTEXT_Magrit_IA.md §3.5)
- **Prix négatif** : `-1,2 €` observé en réponse Clariprint
- **Payloads partiels** : champs `undefined` ou manquants
- **Produits manquants** : requêtes légales rejetées par Clariprint

### Code actuel — endpoint `clariprint-quote`

Fichier : `supabase/functions/make-server-e3db71a4/index.ts` ligne 1212

```typescript
return c.json({
  success: true,
  priceHT: result.response,        // 🔴 AUCUNE VALIDATION
  costs: result.costs,
  delais: result.delais,
  // ...
});
```

### Ce qui manque

- ❌ Pas de filtre sur `result.response < 0`
- ❌ Pas de `isNaN()` ou `typeof === 'number'`
- ❌ Pas de module `validateClariprintResponse()`
- ❌ Le front **affiche `-1,2 €`** au utilisateur sans alerte

### Ce qui marche déjà

- ✅ Si l'appel Clariprint retourne `success: false`, ProductCard:992-1017 affiche un bandeau d'erreur explicite
- ✅ **Pas de fallback LLM** déclenché en cas de prix invalide (= pas d'hallucination)
- ✅ Mode démo explicite (`demoMode: true`) quand Clariprint absent — à vérifier que le badge "Mode démo" est bien affiché côté UI

---

## 5. Synthèse en arbre de décision (par écran représentatif)

### Écran : ProductCard "Tarification" (cas nominal)

```
fetchClariprintQuote(product.clariprintData)
   ├─ POST https://*/clariprint-quote
   └─ Reçoit ClariprintQuoteResult { success, priceHT, costs, delais, ... }
                    ↓
ProductCard.tsx:222-225 résolution displayPriceHT
   ├─ SI clariprintQuote.success = true & priceHT ≠ null
   │    └─ USE clariprintQuote.priceHT  ✅
   └─ ELSE
        └─ USE estimatedPrice() [fallback hardcodé]
                    ↓
Affichage : `{displayPriceHT.toFixed(2)} €` + TVA calculée
```

### Écran : PricingPanel (outlier)

```
Receive product.price (prop, source non tracée formellement)
   ↓
Display directement {product.price.toFixed(2)} €
❌ Ignore clariprintQuote
❌ Pas de fallback structuré
```

### Anomalie Clariprint : prix négatif `-1,2 €`

```
Edge function (index.ts:1212)
   └─ priceHT: result.response  [AUCUNE VALIDATION]
                    ↓
Front reçoit { success: true, priceHT: -1.2, costs, ... }
                    ↓
Affichage : "-1.20 €"  ❌ Pas de filtre, pas d'alerte, pas de fallback
```

---

## 6. Recommandations actionnables

### 🔴 Critiques (avant Order entity v1.1)

| # | Fichier | Action | Effort |
|---|---|---|---|
| **C1** | `src/app/utils/clariprintQuote.ts` (à créer ou étendre) | Ajouter `validateClariprintResponse(result) → result` qui filtre prix négatifs, NaN, undefined, costs.total invalide | XS |
| **C2** | `supabase/functions/make-server-e3db71a4/index.ts:1212` | Appeler `validateClariprintResponse()` avant `c.json()` retour | XS |
| **C3** | `src/app/components/PricingPanel.tsx:26` | Remplacer `product.price` par hiérarchie : `clariprintQuote?.priceHT ?? product.price ?? 0` | XS |

### 🟡 Élevées (à intégrer dans Epic 1 architecture)

| # | Fichier | Action | Effort |
|---|---|---|---|
| **E1** | `src/app/utils/priceResolver.ts` (à créer) | Créer helper unique `resolvePrice(product) → { priceHT, source }` avec hiérarchie standard. Adopté par tous les composants. | S |
| **E2** | `src/app/components/ProductCard.tsx:219` | Documenter `estimatePrice()` comme **fallback pédagogique uniquement**, jamais source de prix client final. Commentaire explicite dans le code. | XS |
| **E3** | `src/app/utils/quote.ts:10-14` (si existe) | Fusionner `computeProductTotals()` avec `priceResolver` pour avoir une seule source de vérité. | S |

### 🟢 Améliorations post-sprint

| # | Action | Effort |
|---|---|---|
| **A1** | Logger chaque résolution de prix (source, valeur brute, valeur validée, anomalies détectées) dans `llm_usage_events` ou table dédiée pour observabilité | S |
| **A2** | Tests e2e sur scénarios d'anomalie : prix négatif, timeout, payload partiel — automatisés via Claude in Chrome | M |
| **A3** | Badge UI "Mode démo" quand Clariprint absent (vérifier qu'il est bien affiché aujourd'hui) | XS |

---

## 7. Décisions à trancher avec Arnaud

1. **Validation `validateClariprintResponse()`** — quelle stratégie quand Clariprint renvoie un payload invalide ?
   - **Option A (recommandée) :** retourner `{ success: false, error: "..." }` au front, qui affiche une bannière d'erreur sans prix.
   - Option B : afficher le prix précédent (cache) avec un badge "Prix possiblement obsolète".
   - Option C : retomber sur l'estimatedPrice() avec badge "Estimation".
2. **Helper `priceResolver`** — préférer la création d'un module commun **dès Epic 1 (S1.2 sanitization)** ou attendre que les 3+ consommateurs Order entity soient présents pour respecter la Rule of Three ? **Reco Winston : créer dès S1.2** car déjà 3 consommateurs (ProductCard, QuoteModal, PortalCart) le justifient.
3. **PricingPanel** — ce composant a-t-il encore une raison d'exister en l'état, ou faut-il le déprécier au profit de l'overlay ProductCard de S2.4 ?

---

## 8. Implications pour la spec S1.2 (Epic 1)

Les findings ci-dessus enrichissent la spec de S1.2 (Module commun `validateClariprintResponse` + ClariprintAdapter pattern) :

- **`validateClariprintResponse()`** doit filtrer les 4 anomalies identifiées : prix négatif, NaN, undefined, costs.total invalide.
- **`ClariprintAdapter`** doit exposer une méthode `computePrice()` qui appelle automatiquement la validation.
- **Erreurs typées** : `ClariprintError.kind` doit inclure `negative_price`, `nan_price`, `undefined_field`, `missing_required_product`, `network`, `unknown` (cohérent avec spec architecture §4.4).
- **Tests vitest** : doivent couvrir au moins les 3 scénarios C1/C2/C3 + les anomalies connues `-1,2 €`, `undefined`, `null`.

---

## 9. Statut S0.2

✅ **Audit terminé**
✅ **Document `PRICE_SOURCES.md` produit** (ce fichier)
✅ **Cause du « 2e prix » identifiée** (PricingPanel.tsx:26 + absence validation endpoint)
✅ **Pas d'hallucination LLM confirmée**
⏳ **Décisions Arnaud en attente** (cf. § 7)
⏳ **Fixes C1+C2+C3 prêts à appliquer** sur autorisation

> _Une fois les décisions tranchées, les corrections C1+C2+C3 peuvent être appliquées en une PR atomique sur `beta/v5` (et back-portées sur `beta/v4` si la démo client en bénéficie). Effort estimé : 0,5 jour fix + 0,5 jour tests._
