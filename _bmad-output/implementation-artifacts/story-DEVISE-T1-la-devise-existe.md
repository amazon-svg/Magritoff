# Story DEVISE-T1 — La devise existe et s'affiche

**Épopée** : Refacto multi-devise (décision Arnaud 2026-08-10)
**Plan de référence** : [`docs/REFACTO_MULTI_DEVISE.md`](../../docs/REFACTO_MULTI_DEVISE.md)
**Branche** : `feat/multi-devise-t1` (partie de `feature/refacto-visuels-gamme-pim`, qui contient `beta/v5`)
**Date** : 2026-08-10
**Statut** : ✅ livrée — build vert, 849 tests verts (64 fichiers)

---

## 1. Pourquoi

Chaque imprimeur doit pouvoir travailler dans **sa** devise. Sans cela Magrit ne peut pas
voyager : pas de client en dollars, pas de déploiement hors zone euro. C'est une condition
de marché, pas un confort. Cohérent avec RP#070826 §6.1.

La tranche 1 est le **prérequis des trois autres** : tant que la devise n'existe pas comme
donnée, aucune des tranches suivantes (coûts en `Money`, prix de vente, documents) n'a de
support sur lequel s'appuyer.

## 2. Périmètre livré

### 2.1 La devise existe en base

- `supabase/migrations/20260810000200_tenant_currency.sql`
  - `tenants.currency char(3) not null default 'EUR'`
  - contrainte `tenants_currency_iso4217` : `^[A-Z]{3}$` — refuse `eur`, `€`, `EURO`
  - fonction `shop_currency(p_slug text)` `SECURITY DEFINER`, `GRANT` à `anon` + `authenticated`
- `src/types/database.types.ts` : colonne + signature RPC ajoutées à la main (le projet
  régénère ces types via `npm run db:types`, qui demande un PAT Supabase).

### 2.2 Un seul helper de formatage

`src/app/utils/currency.ts` — nouveau module, calqué sur la structure de `tax.ts` (même
précédent : une décision fiscale/monétaire par tenant, un helper unique, un défaut assumé).

| Export | Rôle |
|---|---|
| `formatMoney(amount, currency, opts?)` | **Le** formateur. Devise en paramètre obligatoire. |
| `getCurrency(tenant)` | Résout la devise du tenant, normalise, replie sur `DEFAULT_CURRENCY`. |
| `getCurrencySymbol(currency, locale?)` | Pour les libellés d'unité (`Prix HT (€)`, adornements d'input). |
| `formatCurrencyPerUnit(currency, unit)` | `€/h`, `$/kWh` — unités composées du parc machine. |
| `getCurrencyDecimals(currency)` | Décimales ISO 4217 (JPY = 0). |
| `SUPPORTED_CURRENCIES` | Liste de sélection : EUR, USD, GBP, CHF, CAD, MAD, JPY. |
| `DEFAULT_CURRENCY` | `'EUR'` — valeur par défaut, plus une hypothèse câblée. |

`formatMoney` est **défensif** : `null` / `undefined` / `NaN` / `Infinity` → `—` (comportement
hérité de `formatEuro`, sur lequel s'appuyaient les écrans du portail), et un code devise
refusé par `Intl` dégrade en `"12,50 ZZZ"` au lieu de faire tomber l'écran.

### 2.3 Les helpers concurrents ont disparu

Le plan annonçait **deux** helpers concurrents. Il y en avait **quatre** :

| Helper | Sort |
|---|---|
| `formatEuro()` — `ProductOverlay.helpers.ts` | **supprimé**, 8 appelants migrés |
| copie locale de `formatEuro` — `OrderHistoryTable.tsx` | **supprimée** (non recensée au relevé initial) |
| copie locale de `formatEuro` — `PortalThankYou.tsx` | **supprimée** (non recensée au relevé initial) |
| `formatPrice()` — `priceResolver.ts` | **conservé mais paramétré** : `formatPrice(resolution, currency, locale?)`, délègue le formatage à `formatMoney`, ne porte plus que la mention « Prix marché » |

Il ne reste aujourd'hui **aucun chemin** permettant de formater un montant sans dire dans
quelle devise il est libellé.

### 2.4 La devise remonte jusqu'aux écrans

Deux chemins de lecture, un seul point d'accès pour les composants :

- **Dashboard et portail** : l'utilisateur est membre du tenant → `getCurrency(currentTenant)`.
- **Boutique publique `/shop/:slug`** : le visiteur est **anonyme**. La RLS `tenants_select`
  lui interdit de lire `tenants`, donc `currentTenant` est `null`. Sans traitement dédié,
  la vitrine d'un imprimeur en dollars aurait affiché des euros — soit exactement ce que la
  tranche devait supprimer.

`src/app/contexts/CurrencyContext.tsx` réconcilie les deux : `PublicShop` résout la devise
via la RPC `shop_currency(slug)` et l'injecte dans `<CurrencyProvider>` ; tout l'arbre
boutique consomme `useCurrency()` sans savoir lequel des deux chemins l'a alimenté, et sans
qu'une prop `currency` traverse une dizaine de niveaux.

Ordre de résolution : override explicite > devise du tenant courant > `DEFAULT_CURRENCY`.

### 2.5 La devise est réglable

`DashboardTenantSettings` (Paramètres de l'espace) — sélecteur `Devise de travail`,
éditable par owner/admin, avec aperçu live du format (`1 234,50 €`) et un avertissement
explicite au changement : **aucune conversion n'est appliquée**, les montants gardent leur
valeur numérique et changent de libellé. C'est le comportement voulu (invariant #4 : pas
de taux de change en V1), mais il devait être dit à l'utilisateur.

`data-testid` déclaré dans `testIds.ts` (`tenant.currencySelect`) — pas d'invention.

### 2.6 Purge des littéraux

103 occurrences relevées, sur ~40 fichiers. Traitées par famille :

| Famille | Traitement |
|---|---|
| Montants affichés (devis, panier, catalogue, KPI, bibliothèques, GesCom) | `formatMoney(x, currency)` |
| Symboles d'unité (`Prix HT (€)`, adornements, placeholder) | `getCurrencySymbol(currency)` |
| Unités composées du parc machine (`€/h`, `€/kg`, `€/kWh`, `€/job`) | `formatCurrencyPerUnit(currency, unit)` |
| Payloads structurés (`schema.org`, export JSON, `tenant_orders`, notification email) | devise passée en paramètre, plus de `'EUR'` en dur |
| Tranches de facettes prix (`< 100 €`) | libellé construit depuis le symbole. **Les bornes ne sont pas converties** : ce sont des repères de navigation, pas des montants — convertir supposerait un taux de change. |

**Deux littéraux `€` conservés volontairement**, tous deux commentés dans le code :

1. `DashboardPlan.tsx` — `29 €/mois` : prix de l'abonnement Magrit **facturé par AGE Dvt.**
   à l'imprimeur. Ce n'est pas la devise dans laquelle l'imprimeur travaille avec ses
   clients. Un imprimeur qui vend en dollars paie toujours son abonnement en euros.
2. Commentaires de prose (`« dès X € »` dans des en-têtes de fichier) — sans effet à l'écran.

## 3. Ce qui a été découvert en cours de route

1. **Quatre implémentations de formatage, pas deux.** Le relevé initial en annonçait deux ;
   deux copies locales supplémentaires dormaient dans le portail. Elles n'auraient pas été
   trouvées par une recherche sur `formatEuro` importé — seulement par la recherche des
   littéraux `EUR`.
2. **Le trou de la boutique publique.** Sans la RPC `SECURITY DEFINER`, la tranche 1 aurait
   été livrée avec le cas d'usage le plus visible (la vitrine) toujours en euros.
3. **La colonne sans écran de saisie n'aurait servi à rien.** Le plan ne mentionnait pas
   d'UI ; sans elle, personne n'aurait pu passer un tenant en dollars.

## 4. Vérification

| Contrôle | Résultat |
|---|---|
| `npm run build` | ✅ vert |
| `npm test` | ✅ **849 tests / 64 fichiers**, tous verts (826 avant, +23 tests `currency.test.ts`) |
| Littéraux `€` restants dans `src/` | 2 volontaires + commentaires de prose |
| Littéraux `'EUR'` restants dans `src/` | 0 hors `currency.ts` et commentaires |
| Imports/déclarations `currency` | vérifiés fichier par fichier (le projet n'a pas TypeScript installé, donc **pas d'étape de typecheck** — contrôle fait par script) |

**Tests mis à jour** : `ProductOverlay.helpers.test.ts` (bloc `formatEuro` déménagé),
`priceResolver.test.ts` (nouvelle signature), `resumeBanner.helpers.test.ts` (devise
requise). **Test créé** : `tests/utils/currency.test.ts` (23 cas — résolution, formatage,
défensif, décimales JPY, symboles, liste de sélection).

⚠️ **Note sur la suite de tests** : 6 tests d'intégration Supabase (`order_roles_rpc`,
`order_audit_trail`) ont échoué lors d'un run complet intermédiaire puis sont repassés
verts, seuls comme en suite complète. Flakiness de contention sur la base partagée, sans
lien avec cette story — comportement identique constaté sur la branche de base.

## 5. Le prix marché passe en zones monétaires (arbitrage du 2026-08-10)

Le point de vigilance n° 1 du plan — les prix de marché calibrés en euros — a été **arbitré
par Arnaud le jour même**, en réponse à la livraison de la tranche 1 :

> « Il verra un prix marché relevant d'imprimeurs ayant la **même monnaie que lui**.
> Autrement dit, nous livrerons des prix marchés **par zone monétaire**, et nous
> **réserverons le droit** de rendre un prix marché d'une monnaie X accessible dans une
> zone Y. »

C'est plus large que « deux prix marchés » : c'est **une zone par devise**, et l'ouverture
inter-zones comme droit réservé. Implémenté dans `src/app/utils/marketPriceZones.ts` :

| Zone | Statut | Sert un prix ? |
|---|---|---|
| EUR | `heuristique` — valeurs historiques déplacées, **non retouchées** | ✅ |
| USD | `a_calibrer` — cible actée, données non collectées | ❌ |
| GBP, CHF, CAD, MAD, JPY | pas de zone | ❌ |

**Effet visible** : un imprimeur hors zone EUR ne voit plus de prix marché du tout — il voit
« Prix sur demande » quand Clariprint ne répond pas. C'est une régression *apparente* qui est
en réalité la correction : avant, il recevait une valeur calibrée en euros, simplement
relibellée dans sa monnaie. Le cache bibliothèque et Clariprint passent toujours avant la
zone, donc un imprimeur en dollars qui a des prix saisis les voit normalement.

**Ce que la séparation a mis au clair** : la *forme* de l'heuristique (dégressivité volume,
majoration grammage, verso, pelliculage) est une structure de **coût de production**, donc
commune à toutes les zones ; seuls les **niveaux de prix** sont propres à une zone. Le code
respecte maintenant cette frontière — `resolveMarketPriceFamily()` reconnaît la famille, la
zone fournit le niveau. C'est aussi ce qui rendra le branchement du futur panel Magrit
mécanique.

**Propagation** : `estimateMarketPriceHT(product, qty?, currency)`, `resolvePrice(product,
quote?, currency)`, `computeGammeFloorPrices(products, gammes, currency)`,
`computeSuccessPhase/computeErrorPhase(..., currency)` — tous les chemins qui produisent un
prix marché portent désormais la devise. 15 tests dédiés dans
`tests/utils/marketPriceZones.test.ts`, dont la non-régression de la zone EUR.

## 6. Limites assumées de la tranche 1

Conformément au plan, et à dire explicitement :

- **Les montants restent des `number` flottants.** Le passage au `Money` du noyau
  (`{ minorUnits: bigint, currency }`) est l'objet des tranches 2 et 3.
- **Aucune conversion de taux de change.** Changer la devise d'un tenant relibelle les
  montants, ne les convertit pas.
- **La zone USD ne sert rien tant que ses données ne sont pas collectées.** C'est une action
  de collecte, pas de code : renseigner `basePerUnit` et passer `status` à `'panel'` suffit
  à l'activer.
- Réserve maintenue pour les **grilles papier/transport** (la devise doit être portée par la
  grille) et les **coûts par défaut de la bibliothèque machines** — à reprendre en tranche 2,
  qui porte précisément sur le modèle de coût.

## 7. État en base — migration APPLIQUÉE et vérifiée

✅ **`20260810000200_tenant_currency.sql` est appliquée** sur Supabase `ightkxebexuzfjdbpsdg`,
enregistrée dans `supabase_migrations.schema_migrations` (version `20260810000200`).
*Correction d'une version antérieure de ce document, qui l'annonçait en attente.*

Vérifications faites sur la base réelle :

| Contrôle | Résultat |
|---|---|
| Colonne `tenants.currency` | `character(3)`, `NOT NULL`, défaut `'EUR'::bpchar` |
| Contrainte `tenants_currency_iso4217` | présente et **active** (un `update` en `'eur'` est rejeté) |
| Fonction `shop_currency` | présente, `EXECUTE` accordé à `anon` **et** `authenticated` |
| RPC en **anonyme** (le cas qui compte) | `shop_currency('eram')` → `"EUR"` ✅ |
| RLS `tenants` en anonyme | lecture directe → `[]` — toujours bloquée ✅ |
| Tenants en base | 166, tous en `EUR` |

Le couple « la RPC sert la devise / la table reste inaccessible » est donc vérifié en
conditions réelles : c'est exactement le comportement visé.

À noter également : `20260808000100_gescom_price_rules.sql` **est également appliquée**
(table `client_price_rules` présente) — le SPRINT_HANDOFF l'annonçait en attente depuis le
2026-08-08. Corrigé.

**Non testé** : la bascule effective d'un tenant en USD de bout en bout. Le test
transactionnel (`update` + vérification + `rollback`) a été refusé par le garde-fou de
permissions, à juste titre — il portait un `UPDATE` sur la base de production. À faire par
Arnaud sur un tenant de test, ou en local.
