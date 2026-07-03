---
story_id: P0.3
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: TenantOnboarding wizard — vérification 8 gammes parents racine (vs 5 actuels)
status: livrée (validation visuelle seule — aucun changement code)
target_branch: beta/v5
agent: Dev (Claude Code) + UX consultation (Sally non requise, H1 confirmé)
size: XS (validation visuelle, 0j dev)
depends_on: P0.2 (livrée, migration appliquée 2026-05-17 — 27 gammes en DB)
ux_consultation: NON requise (H1 confirmé après lecture composant)
---

# Story P0.3 — Wizard onboarding 8 parents racine

## Story (As / I want / So that)

**As an** Owner tenant qui crée son espace Magrit via `/tenants/new`
**I want** voir et sélectionner mes gammes (incluant les 5 nouvelles : kakémono, étiquette, banderole, dépliant plié DL, roll-up) sans que le wizard devienne illisible ou tronqué
**So that** je puisse souscrire à toutes les familles de produits pertinents pour mon imprimerie sans devoir contourner le wizard ou y revenir plus tard.

## Contexte

Le wizard `TenantOnboarding.tsx` (Story E9.6 livrée Sprint 2 commit Sprint 2) propose un step 2 "Quelles gammes utilisez-vous ?" qui rend la liste hiérarchique `product_gammes` avec :
- 6 gammes **parents** affichées au niveau racine (carterie, flyer, affiche, depliant, brochure + 1 utilisée comme structure)
- Chaque parent dépliable révèle ses sous-gammes (ex: carterie → 5 sous-gammes cartes)

Après la story P0.2, le catalogue passe à **11 parents** (les 6 actuels + kakemono, roll-up considérée parent du sous-niveau, etiquette, banderole, depliant_plie_dl reste sous depliant). En réalité **9 parents racine** :
- carterie, flyer, affiche, depliant, brochure (existants)
- kakemono, etiquette, banderole (nouveaux, root)
- roll_up_80x200 reste sous kakemono, depliant_plie_dl reste sous depliant

→ wizard étendu de 6 à **9 parents racine**. Vérifier la compatibilité UI.

## Pre-flight UX — Conclusion H1 confirmé (2026-05-17)

Lecture composant `TenantOnboarding.tsx` ligne 163-477 :
- Le wizard **n'est PAS dans une modale** : c'est une **vraie page** (`min-h-[calc(100vh-56px)]` avec scroll de page natif via `body`).
- Le container des gammes (ligne 433) est `grid grid-cols-1 sm:grid-cols-2 gap-2` (responsive) :
  - Desktop ≥ 640px : 2 colonnes → 8 parents racine = 4 lignes ≈ 250-300px
  - Mobile < 640px : 1 colonne → 8 parents racine = 8 lignes ≈ 500-550px (scroll page natif OK)
- `rootGammes` (ligne 89) filtre via `gammes.filter((g) => !g.parent_slug)` → après P0.2, les 3 nouvelles gammes racine (`kakemono`, `etiquette`, `banderole`) apparaissent automatiquement. `roll_up_80x200` reste sous `kakemono`, `depliant_plie_dl` reste sous `depliant`.

→ **H1 confirmé** : aucune adaptation code nécessaire. La page absorbe nativement l'extension à 8 parents racine.

→ **Sally non invoquée** (pas de décision design lourde, pas de refonte de groupage par "Univers").

**Correction du compte initial** : j'avais sur-compté à "11 parents" puis "9 parents" — la réalité est **8 parents racine** : carterie, flyer, affiche, depliant, brochure (5 existants) + kakemono, etiquette, banderole (3 nouveaux). Sous-gammes : roll_up_80x200 sous kakemono, depliant_plie_dl sous depliant.

## Acceptance Criteria

**AC1** — Le wizard `TenantOnboarding.tsx` step 2 affiche les **9 parents racine** (`carterie`, `flyer`, `affiche`, `depliant`, `brochure`, `kakemono`, `etiquette`, `banderole` + ordre via `display_order` ASC).

**AC2** — Tous les parents restent **dépliables individuellement** ; les sous-gammes (carte_visite_standard, flyer_a4, roll_up_80x200, depliant_plie_dl, etc.) apparaissent à l'ouverture.

**AC3** — La liste tient dans la viewport sans déborder le footer du wizard (boutons "Précédent" / "Suivant" toujours visibles).

**AC4** — Sur viewport mobile (375px largeur), la liste reste utilisable (scroll vertical OK, pas de scroll horizontal).

**AC5** — Aucune régression visuelle sur les 5 parents existants : ordre, libellé, icône / chevron de dépliage inchangés.

**AC6** — Le compte de gammes affiché en synthèse (le wizard affiche un compteur "X gammes sélectionnées" si présent) intègre correctement les sous-gammes des 4 nouvelles parents.

**AC7** — Aucun test vitest ne casse (les tests existants couvrant `TenantOnboarding` doivent passer sans modification).

## Décisions techniques (à figer après lecture du composant)

| Décision | Choix attendu | Argument |
|---|---|---|
| Scroll container | À identifier dans le code | H1/H2/H3 cf. pre-flight |
| Tri parents | `display_order ASC` (déjà via fetch) | Cohérence avec wizard actuel |
| Groupage par "Univers" | Reporté à plus tard | Hors scope MVP si H1/H2 suffisent |
| Sally à invoquer | Si H3 | Pragmatisme — éviter sur-design d'un ajustement mineur |

## Fichiers potentiellement touchés

- `src/app/components/tenant/TenantOnboarding.tsx` : (à vérifier) probable ajout `overflow-y-auto max-h-[60vh]` sur le container des gammes
- `tests/contexts/TenantOnboarding.test.ts` ou équivalent : à vérifier si existant

## Tests / Vérifications

1. **Test manuel viewport desktop** (1440px) : 9 parents lisibles, scroll si besoin OK
2. **Test manuel viewport mobile** (375px) : 9 parents lisibles, scroll vertical OK, pas de scroll horizontal
3. **Test fonctionnel** : souscrire à 1 gamme dans chaque parent (9 gammes) → après "Suivant" + création tenant, `tenant_gamme_subscriptions` contient bien les 9 lignes
4. **Test régression** : tests vitest existants passent

## TF Notion à créer en fin de story

- **TF "Wizard onboarding tenant supporte les 9 gammes parents"** :
  - Parcours : P00 — Création espace tenant
  - Persona : Owner tenant
  - Type : Manuel humain + IA Chrome
  - URL départ : http://localhost:5177/tenants/new
  - Étapes : créer un tenant, arriver au step 2, vérifier que les 9 parents sont visibles et dépliables
  - Hints DOM : `[data-testid=tenant-onboarding-step2]`, gammes racine en `<li data-gamme-parent="...">`

## Notes

Story dépendante de P0.2 (les 5 nouvelles gammes doivent être en DB). Sans P0.2, le wizard verra toujours 5 parents. À séquencer : P0.2 d'abord, puis P0.3.

UX simple à priori (scroll container suffit). Sally en consultation **uniquement** si on découvre que la viewport est cassée → refonte design groupage par Univers.
