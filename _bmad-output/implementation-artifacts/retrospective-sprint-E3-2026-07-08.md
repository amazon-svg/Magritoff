# Rétrospective — Sprint E3 Navigation (Epic 2 e-commerce)

- **Date clôture** : 2026-07-08
- **Branche** : `beta/v5` (HEAD `d731243`, poussé `origin/beta/v5` sync 0/0)
- **Périmètre** : S2.18 · cohérence catégorie (ADR-4.17) · S2.19 · S2.21 · S2.20
- **Tests** : 650 → **709 vitest verts**, 0 régression

## Ce qui a été livré

| # | Livrable | Valeur |
|---|---|---|
| S2.18 | Méga-menu familles → sous-catégories | Navigation e-commerce standard, repère visuel cohérent |
| — | Cohérence catégorie explicite (ADR-4.17) | La gamme (pas le format) définit la famille, partout |
| S2.19 | Fil d'Ariane + facettes Format/Prix | Le format devient un filtre légitime, pas une catégorie |
| S2.21 | Recherche + autocomplétion + fallback Magrit | Jamais de cul-de-sac : produits/familles instantanés, sinon IA |
| S2.20 | Landing catégorie éditorialisée LLM | Page structurée auto-générée, jamais vide |

## Ce qui a bien marché

- **Détour cohérence assumé** : l'incohérence méga-menu (Affiches sous Flyers) a révélé un problème de fond (format ≠ catégorie). Plutôt que patcher l'affichage, on a créé `gamme_slug` explicite (ADR-4.17) et unifié tous les consommateurs sur `resolveProductGamme`. Dette réglée à la racine.
- **Pattern « socle déterministe + enrichissement IA »** (S2.20) : réutilise la philosophie S-CONSO-4 (résilience LLM). La page marche sans réseau et l'IA n'est qu'un bonus → « jamais de page vide » garanti par construction, pas par espoir.
- **Réutilisation forte** : S2.21 s'appuie sur `askMagrit`, `selectGammes`, `buildShopTaxonomy` existants ; le vrai delta (autocomplétion) est resté petit et testable.
- **Vérif live avant clôture** : endpoint `category-editorial` testé en conditions réelles (réponse Haiku sur « Affiches ») avant de déclarer S2.20 livrée.

## Frictions / leçons

- **Endpoint LLM dupliqué** (déjà noté sessions passées) : le vrai endpoint produit est `make-server-e3db71a4/claude-proxy`, pas le standalone `claude-proxy`. Toujours vérifier quel endpoint le front appelle avant d'éditer un prompt.
- **Données POC minces** : sous-catégories seedées au niveau racine → tuiles sous-catégories et sous-menus méga-menu souvent vides. Dégradé gracieux implémenté, mais un seed sous-catégories démo-friendly reste souhaitable pour montrer la profondeur de navigation.
- **PAT réutilisé 2 sessions** : hygiène sécurité — le PAT de déploiement doit être révoqué après usage. Idéalement, le stocker en Keychain (comme documenté) et le passer en env, jamais en clair.

## Actions de suivi

1. **Révoquer le PAT Supabase** de déploiement.
2. **S-CAT-EDIT** : UI PIM pour éditer la catégorie d'un produit (aujourd'hui seed + LLM).
3. **Seed sous-catégories démo-friendly** (optionnel) pour valoriser méga-menu + landing.
4. **Cadrer Sprint E4** : S2.22 (navigation par intention/usage IA) → S2.31.
5. **Remontée `beta/v5 → main`** : vérifier l'écart avant merge (convention par sprint).
