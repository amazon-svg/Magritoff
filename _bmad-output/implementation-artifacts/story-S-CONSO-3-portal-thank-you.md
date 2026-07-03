---
story_id: S-CONSO-3
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 2 Boutique consolidation)
title: Page de confirmation commande PortalThankYou
status: livrée (test manuel pending Arnaud)
delivered_at: 2026-05-18
final_result: "PortalThankYou.tsx créé (200 lignes). Helper formatShortOrderId pur testé (7 cas vitest). Type PortalView étendu 'thankYou'. PublicShop submitCart() bascule vers thankYou au lieu d'alert. Fallback redirect catalog si lastOrderId absent. A11y : role=status + aria-live + focus auto h1. 335 tests vitest verts (+7)."
target_branch: beta/v5
agent: Dev (Claude Code) + UX consultation Sally validée
size: M (~1.5j)
depends_on: S-MIGRATION-ORDERS (commande créée dans tenant_orders avec id)
unblocks: démo 23/05 (priorité Sally)
ux_consultation: validée (Sally 18/05)
prio_demo_23_05: HAUTE (parcours acheteur complet)
---

# Story S-CONSO-3 — PortalThankYou

## Story (As / I want / So that)

**As an** acheteur B2B qui vient de valider son panier sur la boutique
**I want** une page de confirmation visuelle persistante (pas une alert qui disparaît) affichant les détails de ma commande
**So that** j'aie un artefact stable (screenshot, transfert comptabilité, partage email) confirmant que ma commande a bien été enregistrée, et que je puisse retourner naturellement au catalogue ou voir mes commandes.

## Contexte

Aujourd'hui, après `submitCart()` (S-MIGRATION-ORDERS livré 18/05), l'UX est :
1. `alert('Commande envoyee. Vous recevrez un email de confirmation.')` (modale système browser)
2. `setView('orders')` (bascule sur la vue Mes commandes)

L'alert disparaît au clic OK. L'acheteur perd la confirmation visuelle (pas de N° commande affiché, pas de récap). Pour persona B2B, c'est un **artefact business critique** (transfert compta, archivage, justificatif interne).

Sally UX consult 18/05 a recommandé : **page dédiée** (pas modal ni toast), URL avec order_id, idempotente au refresh.

## Acceptance Criteria

**AC1** — Nouveau composant `PortalThankYou.tsx` dans `src/app/components/shop/portal/` qui affiche :
- Icône succès (Lucide `CheckCircle2`) emerald-600
- Titre : "Commande confirmée" (h1)
- Sous-titre : "Référence #{shortId}" (font-mono, 8 premiers chars de l'order_id)
- Bandeau gris neutre : "Un email de confirmation vous sera envoyé prochainement" (no promesse forte, S3.5 Phase 3)
- Récap commande : email destinataire (user.email), total TTC, date/heure
- Liste compacte items : nom + quantity + sous-total HT
- CTA primaire : "Retour catalogue" → setView('catalog')
- CTA secondaire : "Voir mes commandes" → setView('orders')

**AC2** — Nouvelle view dans `PublicShop.tsx` : `PortalView = ... | 'thankYou'`. submitCart bascule vers `setView('thankYou')` au lieu de `setView('orders')` après succès. Le state passe l'order_id créé.

**AC3** — Lecture order : `PortalThankYou` query `tenant_orders + tenant_order_items` par order_id passé en prop (pas via URL pour MVP, mais via state PublicShop). Idempotent au refresh (URL ne change pas, donc refresh = retour au catalog naturellement, pas d'écran orphelin).

**AC4** — Si `order_id` absent (cas edge bug) : redirect immédiat vers catalog avec un console.warn.

**AC5** — A11y :
- `<h1>` unique
- `role="status"` + `aria-live="polite"` sur le bloc confirmation principal
- Focus auto sur `<h1>` au mount (via ref + useEffect)
- Bouton "Retour catalogue" = focus-visible:ring

**AC6** — Tests vitest sur les helpers extraits si applicable (ex: `formatShortOrderId(id)` qui retourne les 8 premiers chars uppercase). Pas de test du composant complet (vitest environment node, pas de testing-library).

**AC7** — Test manuel : passer une commande sur localhost:5177 → vérifier la page de confirmation s'affiche → cliquer "Retour catalogue" → retour OK.

## Décisions techniques

| Décision | Choix | Argument |
|---|---|---|
| URL dédiée vs state | State PublicShop (view='thankYou') | Cohérent avec le pattern existant (toutes les vues sont en state, pas en URL). Pas de routing supplémentaire. |
| Refresh page = redirect catalog | Oui (idempotent) | Sally Conv : pas d'écran orphelin. Simple à implémenter (state perdu = setView default). |
| shortId format | 8 premiers chars uppercase de l'UUID order_id | Plus parlant que l'UUID complet (38 chars), suffisant pour référence B2B. Ex: `B1C3D4E5` |
| Format date | `new Date(order.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })` | Cohérent avec PortalOrders formatDate |
| Email destinataire | user.email (acheteur authentifié, RLS l'oblige depuis S-MIGRATION-ORDERS) | Cohérent avec persona B2B authentifié |

## Snippet Sally (référence)

```jsx
<div className="mx-auto max-w-2xl px-4 py-12 text-center">
  <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" aria-hidden="true" />
  <h1 className="mt-4 text-2xl font-semibold" ref={h1Ref} tabIndex={-1}>
    Commande confirmée
  </h1>
  <p className="mt-2 text-muted-foreground">Référence #{shortId}</p>
  {/* ... */}
</div>
```

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Query tenant_orders échoue (RLS) | Fallback empty state "Référence introuvable" + CTA retour catalog |
| user.email null | Edge case impossible si submitCart auth check passé. Mais safe : fallback "—" |
| Refresh page = écran orphelin | AC4 redirect catalog |

## Fichiers touchés

- `src/app/components/shop/portal/PortalThankYou.tsx` : nouveau (~80 lignes)
- `src/app/components/shop/portal/types.ts` : ajout `'thankYou'` à `PortalView`
- `src/app/components/shop/PublicShop.tsx` : ajout view + bascule setView post-submitCart
- `src/app/lib/testIds.ts` : ajout testid (`thankYouPage`, `thankYouCtaCatalog`, `thankYouCtaOrders`)

## TF Notion à créer

- **TF "PortalThankYou apparait apres submitCart avec details commande"** :
  - Parcours : P09 — Boutique portail B2B
  - Persona : Acheteur shop_only
  - Type : Manuel humain + IA Chrome
  - Étapes : panier validé → vérifier page confirmation → clic CTA retour catalog

## Notes

Story prio HAUTE pour démo 23/05 (parcours acheteur visible end-to-end : configure → panier → confirme → revient).
