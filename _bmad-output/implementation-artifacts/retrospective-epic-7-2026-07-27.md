# Rétrospective — Epic 7 « Gabarit boutique v2 aligné Printoclock » (S7.1 → S7.14)

- **Date rétro** : 2026-07-27
- **Périmètre** : 14/14 stories, 3 sprints V2-A (S7.1-S7.5) / V2-B (S7.6-S7.9) / V2-C (S7.10-S7.14), livrés en une session le 2026-07-26
- **Branche** : `beta/v5` (HEAD `c1b0c8f` incluant le correctif visuels tuiles post-epic)
- **ADR instanciées** : §4.18 (« dès X € » client-side), §4.19 (SEO SPA routes réelles + sitemap edge), §4.20 (access_mode + RPC self-signup + checkout ≤ 2 écrans)

## Métriques consolidées

| Indicateur | Valeur |
|---|---|
| Tests vitest | 723 → **837 verts** (+114, 0 régression exigée à chaque story) |
| Migrations DB prod | 1 (`20260726000100` : `shops.access_mode` + RPC `self_register_shop_buyer`) |
| Edge functions prod | 1 (`shop-sitemap`, cache 1 h, 404 boutiques privées) |
| a11y | 0 violation WCAG 2A/AA sur les 6 routes v2 (axe 4.11) |
| Smokes E2E prod | Parcours 1 self-signup complet (compte éphémère, commande, nettoyage) + smoke acheteur AI (DoD #3) |
| TF Notion | 12 fiches TF-S7.1 → TF-S7.13 créées via MCP, statut « À jouer » |

## Ce qui a bien marché

- **Route-driven partout (S7.1)** : la bascule des vues state-driven vers de vraies URLs (`/g/:gamme`, `/account/*`, `/checkout`) a débloqué tout le reste — deep-links, SEO, sitemap. La lesson 2026-06-10 (« state interne ≠ route ») est soldée à la racine.
- **Moteur de prix unique (S7.2)** : `useProductConfigurator` extrait iso-fonctionnel de l'overlay puis réutilisé tel quel par la page gamme (S7.3). Zéro duplication de la logique prix/debounce/abort.
- **Honnêteté de la donnée** (fil rouge) : mocks supprimés (Léa, #CMD, 72 h — S7.8), réassurance dérivée des claims réels (S7.7), chips ResumeBanner absentes si vides (S7.9), jamais d'`offers` JSON-LD sur prix estimé (S7.5), jamais « dès 0 € » (S7.6).
- **Sécurité multi-tenant** : RPC `self_register_shop_buyer` SECURITY DEFINER en allow-list stricte (member + `shop_only` + 1 boutique), idempotente, défaut `invite_only` + `noindex` partout (rétro-compat totale).
- **Méthode** : ADR Winston tranchées avant code ; helpers purs testables sans DOM (pattern systématique S7.1→S7.9) ; refactor iso-fonctionnel avant réutilisation ; smoke live prod avant clôture ; TF créés directement dans Notion via MCP (fin du copy-paste).

## Difficultés / bugs débusqués en route

- **FIX FK critique (S7.12)** : `tenant_order_items.product_id` référence `product_library` (`product.product_id`), pas l'id de ligne `shop_products` — tout panier avec produit manuel échouait au checkout. Débusqué par l'E2E prod.
- **Redirect qui perdait la query** (S7.10) : `?tab=` droppé par le redirect canonique — corrigé génériquement, ce qui répare aussi le deep-linking emails S-ORDER-ROLES.
- **Side-effect pendant le render** (S7.1) : navigation thank-you en IIFE remplacée par `<Navigate>` déclaratif.
- **Doublons purgés** : bloc reprise S2.16 vs ResumeBanner (S7.9), raccourci « Commande multi-sites » mort (S7.8), définitions PIM EN en doublon contournées par priorité locale fr (S7.4).
- **Rate-limit auth Supabase** sur suites vitest enchaînées : les runs doivent être espacés (consigne de session désormais).
- **Post-epic** : tuiles gammes home livrées avec un picto inventé au lieu des mockups validés → correctif `c1b0c8f` + lesson 2026-07-27 (tout visuel produit passe par `resolveProductImage()`).

## Suivi de la rétro précédente (Sprint E3, 2026-07-08)

| Action E3 | Sort |
|---|---|
| Révoquer le PAT Supabase | Remplacée par décision Arnaud : PAT en Keychain (`supabase-pat-magrit`), conservé |
| S-CAT-EDIT (UI PIM catégorie) | Couvert par S-PIM-EXAPRINT (2026-07-10, PIM complet) |
| Seed sous-catégories démo | Partiellement couvert par le PIM Exaprint ; non bloquant POC |
| Cadrer Sprint E4 (S2.22-S2.31) | Dépriorisé au profit de l'Epic 7 — reste au backlog Epic 2 |
| Remontée beta/v5 → main | ✅ Faite (commit `86746a1`) |

## Arbitrages produits tranchés et appliqués (2026-07-27, en séance de rétro)

1. **Autoconfirm GoTrue = ON** (`mailer_autoconfirm: true`, projet `ightkxebexuzfjdbpsdg`) — parcours 1 sans friction confirmé par smoke prod : signup → session immédiate → RPC → acheteur `shop_only` ERAM → nettoyage. ⚠️ Réglage projet-wide (B4+B5 partagés).
2. **Boutique pilote = ERAM** : passée en `self_signup`, slug renommé `eram` (URLs indexables propres — les anciens liens `xyfjjo-q6kekm` sont cassés, assumé), `contact_email = a.mazon@me.com`. Sitemap vérifié (`?slug=eram` OK, boutiques privées 404). Nota : Biocoop (créée le 27/07 en self_signup) reste également ouverte.
3. **« Demander un accès » = mailto conservé** (calibrage POC). Resend dédié reste tracé si le besoin se confirme en bêta.

## Dette / limites tracées (reportées consciemment)

- **Clavier-only + responsive 3 largeurs** : vérifiés par sondage seulement → à rejouer en TF humain (les TF-S7.x « À jouer » couvrent une partie).
- **Pari SEO client-side** (§4.19-2) : meta/JSON-LD rendus en JS, pas de SSR/prerender. À vérifier sur l'indexation réelle — **prérequis structurant : l'app B5 tourne sur localhost:5177, l'indexation effective attend un déploiement public de la SPA** (les URLs du sitemap pointent aujourd'hui sur l'hôte Supabase, à rebaser sur le futur domaine public).
- **Chat Magrit pré-contextualisé depuis la page gamme** : raffinement Phase 2+ (filet actuel = recherche catalogue).
- **S-GAMME-FLOOR-CLARIPRINT** : prix planchers réels batch, V2+ post-POC.
- **Budget acheteur** : section masquée tant que pas de backend réel.
- **Nettoyage PIM définitions EN en doublon** : chantier validé en rétro, à planifier (le repli locale fr de S7.4 protège en attendant).

## Leçons à retenir (candidates lessons.md — déjà capturées pour la plupart)

1. Un E2E joué contre la prod avant clôture débusque ce que 800 tests unitaires ne voient pas (FIX FK S7.12).
2. Les défauts sûrs (`invite_only`, `noindex`) rendent une migration de surface publique dérisquée par construction.
3. Le pattern « helpers purs + hook mince » tient sur 14 stories sans exception — à conserver comme convention d'epic.
4. Tout visuel produit passe par `resolveProductImage()` (lesson 2026-07-27, correctif post-epic).

## Prochaines étapes

1. Remontée `beta/v5` → `main` de fin de sprint (écart vérifié : 41 commits d'avance, 3 commits main = merges antérieurs + chore B1, pas de divergence de contenu).
2. Dérouler les TF-S7.x « À jouer » (Notion 🧪) via Claude in Chrome, passer les statuts.
3. Chantier nettoyage PIM EN (session dédiée).
4. Le jour du déploiement public : rebaser les URLs du sitemap sur le domaine, soumettre à Search Console, vérifier l'indexation réelle (pari §4.19).
5. Epic suivant non défini dans epics.md — le backlog vivant reste : Epic 2 suite (S2.22-S2.31), chat pré-contextualisé, S-GAMME-FLOOR-CLARIPRINT, packaging V2+.
