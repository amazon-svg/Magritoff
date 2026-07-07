---
stepsCompleted: [1, 2, 3, 4, 5]
scope: 'Extension boutique e-commerce standard (Epic 2 S2.11-S2.31, FR-ECOM-01..20)'
documentsAssessed:
  - prd.md (Domaine 11)
  - epics.md (Epic 2 étendu)
  - architecture.md (ADR §4.13-§4.16)
  - ux-design-ecom-boutique-2026-07-07.md
verdict: 'GO conditionnel'
date: '2026-07-07'
---

# Implementation Readiness Report — Extension boutique e-commerce

> **Périmètre** : uniquement l extension e-commerce standard (FR-ECOM-01..20 / S2.11-S2.31). Le PRD/Epics historique (FR1-50, S1.x-S6.x) n est PAS re-audité ici.
> **Verdict global : 🟢 GO conditionnel** — traçabilité complète, aucun trou bloquant. 3 compléments UX mineurs à fermer avant le dev des stories concernées + 1 mise à jour doc.

## 1. Matrice de traçabilité FR-ECOM → Story → ADR → UX

| FR | Story | ADR (si DB/contrat) | Couverture UX | État |
|---|---|---|---|---|
| FR-ECOM-01 bandeau famille | S2.11 | — | §1 ProductCard | ✅ |
| FR-ECOM-02 badges | S2.12 | — (audit seuils) | §1 | ✅ |
| FR-ECOM-03 puces PIM | S2.13 | — | §1 | ✅ |
| FR-ECOM-04 mockup-signature | S2.14 | — (dépend Epic4/P18) | §1+§2 (léger) | ⚠️ UX léger |
| FR-ECOM-05 nouveautés | S2.15 | — | §4 Home | ✅ |
| FR-ECOM-06 devis/reprise | S2.16 | — | §4 | ✅ |
| FR-ECOM-07 best-sellers secteur | S2.17 | §4.14 ✅ | §4 | ✅ |
| FR-ECOM-08 méga-menu | S2.18 | — | §2 | ✅ |
| FR-ECOM-09 breadcrumb+facettes | S2.19 | — | §3 (fondu) | ⚠️ UX léger |
| FR-ECOM-10 landing catégorie | S2.20 | — | §3 | ✅ |
| FR-ECOM-11 recherche+Magrit | S2.21 | §4.15 ✅ | §5 | ✅ |
| FR-ECOM-12 nav intention IA | S2.22 | — (split flag) | **absent** | ⚠️ UX manquant |
| FR-ECOM-13 cross-sell IA | S2.23 | — | §4 | ✅ |
| FR-ECOM-14 product finder | S2.24 | — | §7 | ✅ |
| FR-ECOM-15 auto-SEO | S2.25 | — | §3 (fallback) | ✅ |
| FR-ECOM-16 rassurance | S2.26 | — | §6 | ✅ |
| FR-ECOM-17 paliers prix | S2.27 | — (resolvePrice existant) | §6 | ✅ |
| FR-ECOM-18 Magrit vendeur | S2.28 | — | §6 | ✅ |
| FR-ECOM-19 favoris/listes | S2.29 | §4.13 ✅ | **absent** | ⚠️ UX manquant |
| FR-ECOM-20 admin boutique | S2.31 | — (audit first) | hors scope acheteur | ✅ |

## 2. Contrôles de cohérence

| Contrôle | Résultat |
|---|---|
| **FR orphelin** (FR sans story) | ✅ Aucun — 20/20 FR-ECOM mappés |
| **Story orpheline** (story sans FR) | ✅ Aucune — S2.11-S2.31 mappées (S2.30 volontairement sauté, tracé) |
| **Stories avec AC** | ✅ Toutes ont des AC Given/When/Then |
| **ADR pour décisions DB/contrat** (DoD #6) | ✅ Les 3 stories à impact schéma (S2.17/S2.21/S2.29) ont leur ADR (§4.14/§4.15/§4.13) |
| **Helpers RLS canoniques** | ✅ ADR §4.16 harmonise ; nouvelles policies utilisent les noms canoniques |
| **Doublon / comparateur / home** | ✅ Pas de duplication : S2.9 (comparateur) et S2.7 (home) réutilisés, pas réécrits ; S3.1/S3.3 réutilisés |
| **Taille des sprints** (DoD #1, 3-5) | ✅ E1=4, E2=3, E3=4, E4=4, E5=4(+S2.9)=5 → tous ≤ 5 |
| **Split >3j** (DoD #7) | ✅ S2.22 et S2.31 explicitement marquées « à scinder » |
| **a11y routes acheteur** (DoD #10) | ✅ UX §handoff : nouvelles routes ajoutées à `pnpm a11y:scan` |
| **testIds** (DoD, convention) | ✅ UX liste les testIds ; note « à déclarer dans testIds.ts avant usage » |

## 3. Constats (aucun bloquant)

### ⚠️ Compléments UX à fermer avant dev des stories concernées (non bloquant global)
- **C1 — S2.22 (nav intention IA)** : aucune section UX dédiée. Story en Sprint **E4** → il reste le temps. À spécifier (comment s affichent/se placent les regroupements d intention) avant que E4 démarre.
- **C2 — S2.29 (favoris/listes)** : aucune section UX dédiée. Pattern standard mais mérite un wireframe (création liste, ajout depuis card, re-commande en lot). Story en Sprint **E5**.
- **C3 — S2.19 (breadcrumb + facettes)** : couvert de façon fondue dans la landing (§3), pas de spec propre des facettes (comportement multi-filtres, état vide). Story en Sprint **E3**.
- **C4 — S2.14 (mockup-signature)** : UX léger, mais c est une story « asset/data » (dépend de la production visuelle P18 étendue), pas un écran → acceptable. **Risque à surveiller** : dépendance externe non-code (production des mockups par gamme) ; fallback prévu donc non bloquant pour E1.

### ⚠️ Mise à jour documentaire (cheap)
- **D1 — FR Coverage Map (epics.md)** : la table « FR → Story » historique couvre FR1-46, pas les FR-ECOM. À compléter pour la traçabilité long terme (non bloquant, la présente matrice §1 fait foi en attendant).

### ✅ Points forts
- Réutilisation rigoureuse de l existant (S2.7, S2.9, S3.1, S3.3, resolvePrice, mockups) → ~5 stories de re-travail évitées.
- Les 3 décisions archi sensibles (surtout §4.14 cross-tenant) sont traitées avec garde anti-fuite explicite (k-anonymité) + audit prod flaggé.
- Décisions UX arbitrées et actées (token-agnostic, repères neutres, home dérivée).

## 4. Verdict & conditions

**🟢 GO pour démarrer le dev — Sprint E1 (S2.11-S2.14) sans réserve** : aucun des compléments ci-dessus ne touche E1 (hors S2.14 dont le fallback protège).

**Conditions à lever au fil de l eau (pas avant E1) :**
1. Compléter UX de **S2.19** avant Sprint E3, **S2.22** avant Sprint E4, **S2.29** avant Sprint E5 (repasser par Sally — DoD #5).
2. Fixer les seuils d audit prod (**S2.12** badges, **S2.14/§4.14** K/M k-anonymité) avant les stories concernées (DoD #4).
3. Compléter la FR Coverage Map d epics.md avec les FR-ECOM (D1) — quand pratique.
4. Chaque story crée son TF Notion + story doc BMAD au démarrage (DoD #8/#9).

**Prochaine action recommandée : Amelia 💻 Dev sur Sprint E1.**
