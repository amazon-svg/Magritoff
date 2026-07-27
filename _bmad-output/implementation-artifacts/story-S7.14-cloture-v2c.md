# Story S7.14 — Clôture gabarit v2 : harmonisation + audits (Epic 7, Sprint V2-C)

> **Statut** : LIVRÉE — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)

## Réalisé

1. **Harmonisation réassurance** : les libellés du bandeau header S7.7 (« Prix
   immédiat par Magrit / Fabriqué en France / Papiers FSC-PEFC ») sont alignés
   avec les claims des cards produits S2.26 (FSC / Fabriqué en France) —
   constat : déjà cohérents, aucun code supplémentaire nécessaire.
2. **a11y** : 0 violation WCAG 2A/AA (axe 4.11) sur les 4 nouvelles routes
   V2-C (`/account/orders`, `/account/quotes`, `/account/profile`,
   `/checkout`) + home vitrine + page gamme (V2-B).
3. **Smoke E2E** : parcours 1 COMPLET joué contre la prod (S7.12) — visiteur
   anonyme → panier → checkout → création de compte self-signup (RPC
   allow-list) → commande confirmée → nettoyage des données éphémères.
   Suite vitest complète 837 verts (incl. smoke acheteur AI DoD #3 + 4 tests
   RPC self-signup contre la prod).
4. **TF Notion** : TF-S7.1 → TF-S7.13 créés directement dans la DB 🧪 via MCP
   (12 fiches, statut À jouer).
5. **Docs** : SPRINT_HANDOFF §21-23, story docs S7.1-S7.14, epics.md Epic 7.

## Limites tracées (suivi hors Epic 7)

- Confirmation email exigée au signUp public (réglage projet GoTrue) : le
  checkout self-signup affiche un message propre mais le parcours 1 « sans
   friction » gagnerait à activer l'autoconfirm OU un magic link — décision
  produit à prendre (sécurité vs friction).
- « Demander un accès » boutique privée = mailto (notification Resend dédiée
  à câbler si le besoin se confirme).
- Parcours clavier-only complet et passe responsive 3 largeurs : vérifiés par
  sondage (chips/paliers/accordéons tabbables, barre basse mobile) — à
  rejouer en TF humain sur la bêta.
- Rate-limit Supabase auth sur suites vitest enchaînées : espacer les runs.
