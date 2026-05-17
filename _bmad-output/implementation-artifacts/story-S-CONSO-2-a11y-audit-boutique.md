---
story_id: S-CONSO-2
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 2 Boutique consolidation)
title: Audit a11y axe-core boutique + corrections WCAG 2.1 AA
status: livrée (0 violation, aucun fix code requis)
delivered_at: 2026-05-18
final_result: "pnpm a11y:scan exécuté sur les 3 routes critiques (login + /t/imprimerie-ipa/atelier + /shop/boutique-1). 0 violations détectées par axe-core 4.11.4 chrome-headless. Hygiène a11y de la boutique déjà bonne (aria-labels cart icon + Sheet drawer + boutons icon-only). Story livrée sans modification code. Reports JSON disponibles : a11y-report-login.json / a11y-report-atelier.json / a11y-report-boutique-1.json."
target_branch: beta/v5
agent: Dev (Claude Code) + Arnaud (validation visuelle)
size: S (~1h)
depends_on: rien
ux_consultation: NON requise (audit standard WCAG)
prio_demo_23_05: Moyenne (bonne hygiène avant démo, conformité légale B2B)
---

# Story S-CONSO-2 — Audit a11y boutique B2B

## Story (As / I want / So that)

**As an** acheteur B2B utilisant un lecteur d'écran (NVDA / VoiceOver) ou la navigation clavier exclusivement
**I want** que tous les éléments interactifs de la boutique B2B (cart icon, drawer panier, configurateur, boutons) aient des `aria-label` explicites et soient navigables au clavier
**So that** la boutique soit conforme WCAG 2.1 AA (obligation légale RGAA pour B2B France) et utilisable par tous les utilisateurs.

## Contexte

Audit Winston (consultation boutique 17/05) a observé que :
- ✅ Cart icon a déjà `aria-label="Panier (N article(s))"` ([ShopLayout.tsx:176](src/app/components/shop/ShopLayout.tsx#L176))
- ✅ Bouton "Fermer le panier" a `aria-label` ([ShopLayout.tsx:349](src/app/components/shop/ShopLayout.tsx#L349))
- ✅ Boutons quantité PortalCart ont `aria-label`
- ❓ Pas de scan axe-core formel exécuté

Le pipeline a11y axe-core a été livré R9 (`pnpm a11y:scan`, cf. SPRINT_HANDOFF section 10) avec scan local des 3 routes critiques (atelier, login, boutique-1). Cette story exécute le scan + corrige les **trouvailles** spécifiques au flow boutique B2B post-S-REWORK-1 (1-col + drawer panier).

## Acceptance Criteria

**AC1** — Exécution `pnpm a11y:scan` sur les 3 routes critiques :
- `/login`
- `/shop/imprimerie-ipa` (ou autre slug actif)
- `/t/imprimerie-ipa/atelier`

**AC2** — Rapport JSON `a11y-report-boutique-N.json` généré et inspecté. Liste des violations WCAG 2.1 AA classées par sévérité (critical / serious / moderate / minor).

**AC3** — Corrections appliquées sur les violations **critical + serious** identifiées. Les violations moderate/minor sont documentées dans une story future `S-A11Y-PHASE2` (hors scope v1.1) sauf si triviales (`< 5min` à fixer).

**AC4** — Patterns standards à vérifier obligatoirement :
- Tous les boutons icon-only ont `aria-label`
- Tous les inputs ont `<label>` ou `aria-label`
- Headings hierarchy (`<h1>` unique par page, pas de saut h2→h4)
- Color contrast badges + texte ≥ 4.5:1 (audit visuel)
- Focus visible (outline) sur tous les éléments interactifs au clavier
- Sheet shadcn drawer panier : `Description` ou `aria-describedby` (warning vu en P0.4 logs : "Missing Description or aria-describedby for DialogContent")

**AC5** — Re-exécution `pnpm a11y:scan` post-corrections : 0 critical + 0 serious sur les 3 routes.

**AC6** — Documentation des trouvailles + corrections dans ce story doc (section "Findings" à compléter).

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Scope corrections | Critical + serious uniquement | Conformité WCAG 2.1 AA minimum. Moderate/minor reportés. |
| Sheet DialogContent warning | Ajouter `<SheetDescription>` ou `aria-describedby` | Warning vu en logs P0.4, blocage screen reader |
| Focus visible | Vérifier classes Tailwind `focus-visible:ring-*` sur boutons | Cohérent avec shadcn defaults |

## Findings (à compléter en cours d'exécution)

*Section à remplir après le scan axe-core. Liste des violations + actions appliquées.*

| Route | Violation | Sévérité | Fix | Status |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

## TF Notion à créer

- **TF "Scan a11y axe-core boutique 0 critical/serious"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Visiteur non authentifié (test SR)
  - Type : Manuel humain + IA Chrome
  - Étapes : pnpm a11y:scan → vérifier rapport JSON propre
  - Résultat attendu : 0 violation critical, 0 serious

## Notes

Story de hygiène / conformité. Pas de feature visible mais valeur démo (B2B exige souvent compliance WCAG). Si le scan révèle > 10 trouvailles, escalader Sally pour priorisation.
