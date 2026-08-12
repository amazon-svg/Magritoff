# Story S7.12 — Checkout ≤ 2 écrans (Epic 7, Sprint V2-C)

> **Statut** : terminé, amendé par AF7.1 — 2026-08-11
> **Agent** : Amelia (bmad-dev-story)
> **ADR** : §4.20 points 4-5 — [identification si non loggé] → récap →
> PortalThankYou. Exigence UX : ≤ 2 écrans entre panier et confirmation.

## Décisions d'implémentation

1. **Route `/checkout`** (vue `checkout`) : le bouton « Passer commande » du
   drawer panier navigue vers le récap (au lieu du submit direct). Panier
   vide → redirect catalogue.
2. **Écran Identification** (non loggé, même page) :
   - boutique `self_signup` : onglets Se connecter / Créer un compte (email,
     mot de passe, nom, société) — `auth.signUp` puis RPC
     `self_register_shop_buyer` (idempotente S7.11) ;
   - boutique `invite_only` : le garde intervient désormais avant le
     catalogue et le checkout ; connexion uniquement, sans création de compte
     ni exposition de `shop.contact_email` ;
   - si le projet exige la confirmation email au signUp (pas de session
     immédiate) → message explicite, pas d'écran cassé.
3. **Écran Récap** (loggé) : lignes du panier (pack forfaitaire S-FIX-PANIER),
   totaux HT/TVA/TTC, bouton « Commander » → `submitCart` existant (RLS,
   notification, ThankYou). Loggé = 1 seul écran. ≤ 2 écrans ✔.
4. `signUp` ne crée l'accès boutique QUE via la RPC allow-list (jamais
   d'écriture directe tenant_members côté client).

## Acceptance Criteria

- **AC1** : loggé : drawer → `/checkout` (récap) → Commander → ThankYou
  (2 clics, 1 écran intermédiaire).
- **AC2** : non loggé sur boutique self_signup : création de compte →
  inscription auto (RPC) → récap sur la même page → Commander → ThankYou
  (2 écrans logiques, 0 navigation supplémentaire).
- **AC3** : non loggé sur boutique invite_only : aucun contenu boutique, pas de
  création de compte ; connexion avec un compte préalablement invité.
- **AC4** : panier vide → catalogue ; erreurs inline (jamais de modal).
- **AC5** : smoke E2E complet self-signup joué contre la prod (compte
  éphémère) ; 0 régression.

## TF Notion — créé directement dans la DB (TF-S7.12)
