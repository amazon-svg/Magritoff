# Story — Refonte UX du tableau de bord (8 points Arnaud)

> Session Claude Code du 2026-08-08 · branche `feature/dashboard-refonte-ux` (base `origin/beta/v5`)
> Demande directe Arnaud, dans le prolongement de la session RP#070826 (Expert Solutions × AGE Dvt., 07/08)

## Les 8 points demandés et leur traitement

| # | Demande | Traitement | Commit |
|---|---|---|---|
| 1 | Charte partout où elle doit l'être | Bascule des 20 écrans dashboard des styles `gray-*` ad hoc vers les tokens charte v2 (`ink`/`paper`/`line`/`brand` + statuts `ok`/`warn`/`err`). Les nouvelles pages (Mon compte, Gestion commerciale, Parc machine) sont écrites nativement dans la charte. | `cd5233b` |
| 2 | Rationaliser les entrées | Nouvelle architecture en 6 groupes : **Atelier** (Devis + en attente + gabarits, Commandes, Historique) · **Catalogue** (Gammes, Bibliothèques) · **Commercial** (Gestion commerciale, Boutiques, Utilisateurs) · **Production** (Parc machine) · **Paramètres** (Espace, Sous-espaces, Workflow & rôles, Plan, Mon compte) · **Plateforme** (PIM global, superadmin). « Paramètres de l'espace » et « Sous-espaces » sont désormais adjacents dans le même groupe. | `2124f69` |
| 3 | Profil dans les paramètres globaux | Fusionné avec Préférences dans **Paramètres → Mon compte** (`/dashboard/account`). L'index du dashboard devient l'Atelier (redirection vers Devis). Anciennes routes redirigées. | `2124f69` |
| 4 | Préférences idem | Même page Mon compte, section Préférences. | `2124f69` |
| 5 | Purge des entrées Mockup selon PRD | L'entrée « Mockups Magrit » (galerie de référence superadmin P5-VISUELS, hors PRD) est **supprimée** (composant + route → redirection PIM global). Conservé, conforme PRD E8.3 : le mockup engine paramétrique et l'upload de visuels custom par boutique (cas d'usage cité d'Arnaud), rangé dans l'onglet Visuels du catalogue de boutique. | `2124f69` |
| 6 | Unifier PIM / « Produits dans cette boutique » | Dans l'éditeur de boutique, les 3 sections empilées du domaine produit deviennent **une section « Catalogue de la boutique » à 3 onglets** : Sources (PIM catalogue complet + bibliothèques), Produits (vue agrégée + prix négociés + exclusions + exports), Visuels (mockups custom). | `1aa5c82` |
| 7 | Nouvelle entrée « Gestion commerciale » | Module complet : règles de prix (marge %, remise %, prix imposé) par gamme ou produit × client précis / groupe de clients / tous les clients, gestion des groupes, moteur `applyCommercialRules()` (règle la plus spécifique gagne), migration SQL avec RLS tenant-scoped. | `66f6e17` |
| 8 | Nouvelle entrée « Parc machine » + wizard | Module conforme aux logiques RP#070826 — détail ci-dessous. | `dc0a4c3` |

## Le wizard Parc machine (point 8) — conformité RP#070826

- **BK-15** : écran d'entrée proposant les **deux parcours de l'arbitrage** — A « Déroulé complet » (position Xavier : question binaire type par type, ordre fixe, pas de navigation libre) et B « Types déclarés » (position Arnaud : qualification préalable, puis revue des seuls types déclarés, onglets dynamiques). **Compteur de clics affiché en permanence** et consigné dans le parc à la fin — c'est le critère d'arbitrage acté en séance. Le wizard EST les deux maquettes comparatives.
- **BK-16** : sélection par facettes cliquables (marque, nombre de couleurs, groupe vernis), logique panier, aucune arborescence. Bibliothèque embarquée de 34 machines (Heidelberg, Komori, Koenig & Bauer, HP Indigo, Xerox, Bobst, Polar, Stahl, Müller Martini…), profondeur historique incluse.
- **BK-17** : massicot obligatoire — le récapitulatif bloque la validation avec un message qui dit la conséquence (« aucun prix ne pourra être calculé ») ; plieuse absente → question de confirmation avec le cas légitime (groupe de pliage en ligne).
- **BK-09/10/13** : qualification interne/externe **disponible mais jamais bloquante**, éditable a posteriori depuis la liste du parc ; machine externe → sous-traitant par autocomplétion sur un référentiel + coût de transport (zéro admis).
- **BK-18** : écrans fournisseurs papier et transport **séparés**, papier d'abord ; le stock papier de l'imprimeur figure dans la liste (BK-08, prix à la feuille).
- **BK-19** : étape encres avec valeurs par défaut modifiables.
- **BK-22** : modèle de coût — taux horaire main-d'œuvre saisi avec défaut proposé (45 €/h), énergie en défaut non saisi.
- **BK-20/21** : récapitulatif avec retour par section, atterrissage sur la liste du parc ; liste filtrable par tags cohérents avec le wizard.

**Statut V1 = maquette fonctionnelle** : bibliothèque machines mock, persistance locale par tenant (`localStorage`). Le stockage définitif rejoindra Clariprint Data (côté Expert Solutions) une fois l'API-first en place — R1/R2 du jeu d'instructions RP#070826, dérogation R5 explicitée en tête de fichier.

## Gestion commerciale — activation

La page fonctionne dès que la migration **`supabase/migrations/20260808000100_gescom_price_rules.sql`** est jouée dans l'éditeur SQL Supabase (projet `ightkxebexuzfjdbpsdg`). Tant qu'elle ne l'est pas, la page affiche un état « migration à appliquer » explicite (détection `42P01`/`PGRST205`).

**Branchement prix (V2 à planifier)** : `applyCommercialRules()` est prêt à être appelé au-dessus de `resolvePrice()` dans le devis (contexte client connu) et le portail boutique (acheteur connecté). Non branché dans cette story — à faire dans une story dédiée avec cas de test.

## Vérifications

- `pnpm build` ✅ (83 modules, 1.7 s) · `pnpm test` ✅ **750 passed / 87 skipped (RLS sans .env.test), 0 failed**
- Boutique publique `/shop/eram` et racine : 0 erreur console.
- **Non vérifié visuellement** (auth requise) : nav dashboard, Mon compte, Gestion commerciale, Parc machine + wizard — checklist de recette transmise à Arnaud en fin de session.

## Dérogations R5 (souplesse sur l'existant)

1. Accès données Supabase direct depuis les nouveaux composants (pattern existant du repo) — mise en conformité API-first avec la migration générale R1.
2. Parc machine : persistance locale en attendant le modèle Fournisseur unifié (BK-07) côté Clariprint Data.
3. Le contenu interne des onglets Sources/Produits de l'éditeur boutique garde des utilitaires de nuances indigo/blue préexistants sur le bloc PIM — à reprendre lors de la refonte des gabarits d'écran (BK-32).
