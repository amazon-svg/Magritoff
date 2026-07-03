---
story_id: S-CONSO-6
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 2 Boutique consolidation)
title: Décision UX workflow N+1 (retrait propre + microcopy)
status: livrée
delivered_at: 2026-05-18
final_result: "Commentaire N+1 retiré de PortalCart.tsx. Microcopy ajoutée sous bouton Passer commande : 'Envoi direct atelier · Validation hiérarchique à venir.' + title attribute fallback desktop. Pas aria-describedby (info contextuelle, pas instruction). Story future S-N1-APPROVAL tracée."
target_branch: beta/v5
agent: Dev (Claude Code) + UX consultation Sally validée
size: XS (~30min)
depends_on: rien
ux_consultation: validée (Sally 18/05) — Option A retrait + microcopy
prio_demo_23_05: HAUTE (Sally — visible démo flow commande)
---

# Story S-CONSO-6 — Décision workflow N+1

## Story (As / I want / So that)

**As an** acheteur B2B qui s'apprête à valider son panier
**I want** comprendre clairement que ma commande sera envoyée directement à l'atelier sans workflow d'approbation hiérarchique (au moins en v1.1)
**So that** je ne sois pas surpris par l'absence d'étape de validation N+1 (présent dans le design original mais pas implémenté) et que l'UX soit transparente sur les fonctionnalités à venir.

## Contexte

[PortalCart.tsx:239-241](src/app/components/shop/portal/PortalCart.tsx#L239-L241) contient un commentaire :
```jsx
{/* Workflow de validation N+1 : retiré tant que le backend B2B
    correspondant n'est pas implémenté */}
```

Le bouton "Passer commande" saute directement le N+1. Côté UX, l'acheteur ne sait pas si cette étape existe ou pas. Si le persona B2B s'attend à une validation hiérarchique (process budget équipe), l'absence sans notice est source de confusion.

Sally UX consult 18/05 a recommandé : **Option A** — retrait propre du placeholder + microcopy transparente. Rejet de Option B (mock front non-fonctionnel = anti-pattern Magrit) et Option C (dette technique sale).

## Acceptance Criteria

**AC1** — Le commentaire `{/* Workflow de validation N+1 : retiré ... */}` est supprimé de PortalCart.tsx (lignes 239-241). Code mort traçable via git history, pas TODO-comment.

**AC2** — Sous le bouton "Passer commande", microcopy informative ajoutée :
```jsx
<p className="mt-2 text-xs text-muted-foreground">
  Envoi direct atelier. Validation hiérarchique : à venir.
</p>
```
Classe Tailwind cohérente design system Magrit (texte muted, petit format).

**AC3** — PAS de checkbox "approbation requise" mockée (anti-pattern Sally — créer attente non tenue, confusion démo).

**AC4** — Tooltip optionnel `(i)` à côté de la microcopy → court texte explicatif "Le workflow d'approbation N+1 sera disponible dans une prochaine version. Pour l'instant, votre commande est envoyée directement à l'imprimeur." (via Radix Tooltip ou `title=` natif).

**AC5** — Issue backlog créée pour Phase 3+ : `S-N1-APPROVAL` (backend workflow + UI panneau N+1). Documentée dans `_bmad-output/implementation-artifacts/deferred-work.md` ou similaire pour traçabilité.

**AC6** — A11y : microcopy n'est **PAS** `aria-describedby` du bouton (Sally — c'est info contextuelle, pas instruction d'action). Lecteur d'écran lit naturellement après le bouton.

**AC7** — Test manuel : ouvrir drawer panier → vérifier la microcopy sous le bouton "Passer commande" → vérifier que cliquer le bouton fonctionne normalement (pas de régression S-MIGRATION-ORDERS).

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| Option retenue | A (retrait + microcopy) | Sally — transparence sans dette technique |
| Microcopy classes | `text-xs text-muted-foreground` | Cohérent design system Magrit |
| Tooltip | Optionnel | AC4 si du temps. Si non, microcopy seule suffit. |
| Story future S-N1-APPROVAL | Documentée hors scope v1.1 | Traçabilité backlog |
| aria-describedby | Non | Sally — pas instruction d'action |

## Fichiers touchés

- `src/app/components/shop/portal/PortalCart.tsx` : suppression commentaire + ajout microcopy
- `_bmad-output/implementation-artifacts/deferred-work.md` : ajout S-N1-APPROVAL (si fichier existe, sinon créer)

## TF Notion à créer

- **TF "PortalCart microcopy transparence workflow N+1"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Acheteur shop_only
  - Type : Manuel humain
  - Étapes : ouvrir panier → vérifier microcopy sous "Passer commande"

## Notes

Story XS rapide. Recommandée par Sally prio HAUTE démo 23/05 (transparence UX visible dans le flow commande, évite confusion client lors de la démo).
