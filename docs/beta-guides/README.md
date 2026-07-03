# Guides bêta Magrit v1.1

> Documentation utilisateur pour l'ouverture bêta 2 dirigeants (accord principe 2026-05-18 démo Groupe ICI).
>
> Cible : dirigeants imprimeurs Pro + leurs équipes (admin tenant, acheteur B2B, validateur, producteur).
>
> Périmètre couvert : Sprint 5 (commandes + invitations) + Sprint 6 (rôles workflow + audit trail) + Sprint 7 (visuels boutique) + Sprint 8 (filiales + fixes).

## Sommaire

| Guide | Persona cible | Sujet |
|---|---|---|
| [admin-tenant.md](admin-tenant.md) | Admin / Owner tenant | Configuration espace, invitations, rôles, sous-tenants, visuels boutique |
| [acheteur-b2b.md](acheteur-b2b.md) | Acheteur B2B (scope shop_only) | Recherche IA, panier, commande, historique |
| [validateur-producteur.md](validateur-producteur.md) | Validateur / Producteur (capabilities can_validate / can_modify) | Validation commandes, transitions statuts, audit trail |

## Vocabulaire commun

| Terme | Définition |
|---|---|
| **Tenant** | Espace de travail Magrit. 1 imprimeur = 1 tenant (sauf multi-sites = 1 tenant racine + N sous-tenants filiales). |
| **Sous-tenant / filiale** | Espace enfant rattaché à un tenant racine (parent_tenant_id). Sert pour les imprimeurs multi-sites (HQ + Paris + Lyon + Bordeaux). |
| **Shop / Boutique** | Catalogue B2B exposé à un client de l'imprimeur (ex: portail ERAM hébergé par Imprimerie IPA). Sous-domaine logique du tenant. |
| **Acheteur** | User avec scope `shop_only` + capability `can_order` sur une ou N shops du tenant. Voit uniquement ses shops autorisées. |
| **Validateur N+1** | User avec capability `can_validate` sur les commandes draft → validated. Configurable par tenant via catalog rôles. |
| **Producteur** | User avec capability `can_modify` pour faire avancer les commandes validated → in_production → shipped. |
| **Capability** | Droit fin sur une action (can_quote, can_order, can_invite, can_validate, can_cancel, can_modify, can_export, can_manage_catalog, can_manage_roles). |
| **Rôle** | Preset de capabilities nommé (Owner, Admin, Acheteur, Validateur, Producteur). Configurable par tenant. |
| **Notify policy** | Politique de notification email Resend par rôle : chain_next (étape suivante), all_roles (tout le monde), none. |

## Préalables bêta

Avant de démarrer un compte bêta :

1. **Création du tenant racine** : Arnaud crée le tenant + assigne Owner au dirigeant via l'admin Magrit.
2. **5 rôles presets seedés automatiquement** : Owner, Admin, Acheteur, Validateur, Producteur (via trigger `tenants_seed_catalogs`).
3. **7 statuts canoniques seedés** : draft, validated, in_production, shipped, delivered, invoiced, cancelled.
4. **8 transitions canoniques seedées** dans la matrice (draft→cancelled self-service, draft→validated can_validate, etc.).
5. **Le dirigeant reçoit ses identifiants** + accès à `/t/<slug>/dashboard`.

## Limites bêta connues

- **Refonte UI PortalOrders avec tabs filtrés par rôle** (Mes commandes / À valider / À approuver / À produire) : tracée S-ORDER-ROLES-3-UI, nécessite Sally UX. Pour l'instant, les commandes sont visibles via la liste plate filtrée par auth.
- **Page admin catalog rôles `/t/:slug/admin/order-roles`** : à venir. Pour l'instant, gestion des assignments via DashboardUsers + matrice Phase A.
- **Wire-up `<OrderAuditTrailModal>` (S3.5)** : composant prêt, bouton Historique à wirer sur OrderHistoryTable lors refonte UI.
- **Wire-up `<ProductMultiView>` (V7)** : composant prêt, à wirer dans ProductCard / ProductOverlay quand Arnaud valide la place dans l'UI.
- **Workflow N+1 chaîné automatique** : pour l'instant, chaque transition est déclenchée manuellement. L'edge `order-workflow-step` notifie les destinataires mais n'enchaîne pas automatiquement vers le N+1.

## Mise à jour

Document maintenu à chaque clôture sprint qualité-first. Dernière mise à jour : **2026-06-01** (post Sprint 9 audit clôture).
