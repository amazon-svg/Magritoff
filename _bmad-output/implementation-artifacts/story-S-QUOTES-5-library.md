---
story_id: S-QUOTES-5
epic: Bibliothèque de devis éditables (v1.1)
title: Bibliothèque de devis — 3 statuts, scope mine/all, actions par ligne
status: livrée (code)
delivered_at: 2026-07-02
target_branch: beta/v5
agent: Dev (Claude Code)
size: M
---

# Story S-QUOTES-5 — Bibliothèque évoluée

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## AC
- **AC1** ✅ `DashboardQuotes` branchée sur `QuotesContext` (fin du `.eq('user_id')` figé).
- **AC2** ✅ Filtres 3 statuts : Tous / En cours / Validé / Rejeté (mapping legacy via `quoteStatus.ts`), avec compteurs.
- **AC3** ✅ Bascule scope **Mes devis / Tous (équipe)** visible seulement si owner/admin/superadmin (`canViewAll`). Colonne « Émetteur » affichée en scope `all` (« Moi » ou id court).
- **AC4** ✅ Actions par ligne (`DropdownMenu`) : Éditer (→ éditeur), Dupliquer (→ éditeur du clone), Supprimer (`AlertDialog` de confirmation).
- **AC5** ✅ KPIs recalculés sur les 3 groupes de statut. Recherche étendue au nom client.
- **AC6** ✅ testIds `quoteLib` (page, scope, row, menu, deleteDialog) — smoke vert. Colonne client ajoutée.

## Limite connue / suite
- **Émetteur** affiché en id court (8 car.) ou « Moi ». La résolution email/nom des membres (jointure `tenant_members`/profil) est un raffinement ultérieur (pas d'exposition directe de `auth.users` côté client).

## Fichiers
- `src/app/components/dashboard/DashboardQuotes.tsx` (réécrite)
