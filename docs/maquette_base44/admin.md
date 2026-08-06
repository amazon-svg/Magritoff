Parfait. On fige ça proprement en **RBAC hiérarchique + portées (tenant / BU / environnement)**, avec **co-admins**, “dernier admin” protégé, invitations par niveau et audits.
Voici une **liste de prompts Base44** (à coller dans l’ordre) pour implémenter exactement tes profils.

---

## Prompt R1 — Rôles & modèle d’autorisations (hiérarchie + portées)

> **Objectif**
> Définir les rôles suivants et leur portée :
>
> * `tenantAdmin` (portée = tenant)
> * `buAdmin`, `buPrinterAdmin`, `buPaperAdmin`, `buProjectAdmin` (portée = BU)
> * `printerAdmin` (portée = PrinterEnvironment)
> * `paperAdmin` (portée = PaperEnvironment)
> * `projectUser` (portée = ProjectEnvironment)
>
> **À faire (entities/ & policy)**
>
> 1. Étendre `TenantMembership` pour accepter `role` ∈ {ci-dessus} et ajouter un modèle **Grant** de portée :
>
>    * `RoleGrant`: `{ id, tenantId, role, scopeType: "TENANT"|"BU"|"PRINTER_ENV"|"PAPER_ENV"|"PROJECT_ENV", scopeId, userId, status }`
>    * Un utilisateur peut cumuler des grants (ex. `buAdmin` sur BU-A + `projectUser` sur PE-42).
> 2. Définir une **matrice de permissions** (actions → rôles/portées autorisés) côté Backend Functions.
> 3. Activer **co-admins** : plusieurs `tenantAdmin` par tenant autorisés.
> 4. Règles de sécurité :
>
>    * **AtLeastOneAdmin** : impossible de retirer/rétrograder/suspendre **le dernier** `tenantAdmin`.
>    * **2FA required** pour promouvoir/dégrader des admins.
>    * Audit de toute action d’admin utilisateurs.

---

## Prompt R2 — Invitations & gestion des membres (tenant / BU / env)

> **Objectif**
> Invitations par email + magic link, à chaque niveau.
>
> **À faire (functions/)**
>
> * `Members.InviteTenantAdmin({ email })` → crée invitation `tenantAdmin` (TENANT scope).
> * `Members.InviteBUAdmin({ buId, email })`, `Members.InviteBuPrinterAdmin({ buId, email })`, `Members.InviteBuPaperAdmin({ buId, email })`, `Members.InviteBuProjectAdmin({ buId, email })`.
> * `Members.InvitePrinterAdmin({ printerEnvId, email })`, `Members.InvitePaperAdmin({ paperEnvId, email })`, `Members.InviteProjectUser({ projectEnvId, email })`.
> * `Members.AcceptInvite({ token })` → crée `UserProfile` si besoin + `RoleGrant` conforme au token (scopeType/scopeId).
> * `Members.RevokeInvite({ inviteId })`, `Members.List({ scopeType?, scopeId? })`.
>   **Contrôles** : scoping serveur strict (l’émetteur doit avoir les droits sur la portée), 2FA requise pour inviter au niveau tenant/BU.

---

## Prompt R3 — UI d’admin utilisateurs (tenant / BU / env)

> **Objectif**
> Trois écrans : **TenantUsers**, **BUUsers**, **EnvUsers**.
>
> **À faire (pages/components)**
>
> * `pages/TenantUsers.jsx` (guard `tenantAdmin`) : liste des membres + bouton **Inviter co-admin** ; actions : promouvoir/dégrader `tenantAdmin`, suspendre/activer, reset 2FA.
> * `pages/BUUsers.jsx` (guard `buAdmin`) : onglets **Admins BU / Printer / Paper / Project** avec boutons d’invite dédiés.
> * `components/env/EnvUsersPanel.jsx` : sur chaque page d’environnement (Printer/Paper/Project), lister les comptes associés (ex. `printerAdmin`) + inviter un nouveau.
> * Modales d’invitation par type (email, rôle fixe, portée préremplie).
> * Toasters i18n + confirmations (mentionner 2FA requise si nécessaire).
>
> **Invisible si non autorisé** (pas juste disabled).

---

## Prompt R4 — Permissions effectives (mappage des actions → rôles)

> **Objectif**
> Implémenter les droits demandés, sans ambiguïté.
>
> **À faire (policy serveur)**
>
> * `tenantAdmin` :
>
>   * inviter co-admin, créer BUs, inviter `buAdmin`, administrer toutes les BUs (lecture/écriture sur toutes ressources du tenant).
> * `buAdmin` :
>
>   * inviter co-`buAdmin`, créer `PrinterEnvironment`, `PaperEnvironment`, `ProjectEnvironment`, inviter `buPrinterAdmin`, `buPaperAdmin`, `buProjectAdmin`, inviter `printerAdmin`, `paperAdmin`, `projectUser`.
> * `buPrinterAdmin` :
>
>   * créer/éditer `PrinterEnvironment` de sa BU, inviter `printerAdmin` sur ces environnements.
> * `buPaperAdmin` :
>
>   * créer/éditer `PaperEnvironment` de sa BU, inviter `paperAdmin`.
> * `buProjectAdmin` :
>
>   * créer/éditer `ProjectEnvironment` de sa BU, inviter `projectUser`.
> * `printerAdmin` :
>
>   * éditer un `PrinterEnvironment` (hors onglet administrateur).
> * `paperAdmin` :
>
>   * éditer un `PaperEnvironment` (hors onglet administrateur).
> * `projectUser` :
>
>   * créer / rechercher / éditer **ses propres** projets dans un `ProjectEnvironment`.
>
> **Implémentation**
>
> * Ajouter des **guards fonctions** par action : `canInvite(role, scope)`, `canCreate(type, scope)`, `canEdit(resource)`, `canView(resource)`.
> * Sur `projectUser`, vérifier `ownerId == ctx.userId` pour l’édition.

---

## Prompt R5 — “Dernier admin”, Owner et 2FA

> **Objectif**
> Éviter tout lockout.
>
> **À faire (policy + data)**
>
> * **AtLeastOneAdmin** : refuser (422 `LAST_ADMIN`) si l’action ferait tomber le nombre d’admins actifs du tenant à 0.
> * **Owner (optionnel)** : champ `isOwner` sur `TenantMembership`. Seul un `Owner` peut supprimer/dégrader un `tenantAdmin`. Interdire suppression du **dernier Owner**.
> * **2FA obligatoire** pour : inviter/dégrader/promouvoir `tenantAdmin` et `buAdmin`.
> * UI : modales de confirmation explicites + toasts i18n.

---

## Prompt R6 — Partages JWT vs comptes utilisateurs

> **Objectif**
> Conserver le **lien partagé** pour cas ponctuels, privilégier comptes pour les rôles permanents.
>
> **À faire**
>
> * `Shares.Create` accepte des **scopes opérationnels** (read, edit.testing, edit.limited) **sans rôle RBAC**.
> * Dans toutes les listes “Users” (tenant/BU/env), afficher **onglet “Invitations (JWT)”** séparé des **comptes**.
> * Audit clair : actions RBAC (invites) ≠ partages (JWT).

---

## Prompt R7 — i18n & UX

> **Objectif**
> Couvrir le vocabulaire des rôles et des erreurs.
>
> **À faire**
>
> * Nouvelles clés : `roles.*`, `invites.*`, `users.lastAdminError`, `users.require2FA`, `users.scope.*`, `users.owner.*`.
> * Banners d’info contextualisés (ex. “Vous gérez BU X — invitations limitées à cette BU”).
> * Aide sur la portée (tooltip `scopeType/scopeId`).

---

## Prompt R8 — Audit & webhooks

> **Objectif**
> Traçabilité et alertes admin.
>
> **À faire (functions/)**
>
> * Logguer : `invite.create/accept/revoke`, `grant.create/update/delete`, `role.promote/demote`, `member.suspend/activate`, `2fa.setup/disable`.
> * Webhooks Slack/Discord (si activés) à chaque action critique.
> * Étendre `AuditDashboard` : filtres par rôle/portée.

---

## Prompt R9 — Migrations & seeds

> **Objectif**
> Basculer le existant sans rupture.
>
> **À faire (functions/migration)**
>
> * `Migration.SeedGrantsFromCurrentState()` :
>
>   * Promouvoir les utilisateurs historiques “admin global” en `tenantAdmin`.
>   * Pour chaque BU où un user opérait déjà : créer le `RoleGrant` correspondant (`buAdmin` si besoin).
>   * Pour chaque partage “imprimeur” courant utilisé de manière permanente : proposer une **conversion** en `printerAdmin` (compte).
> * Dry-run + rapport CSV/JSON.

---

## Prompt R10 — Tests manuels (checklist)

> **Objectif**
> Vérifier les parcours critiques (Base44 ne supportant pas Cypress).
>
> **À faire**
>
> * Ajouter à `components/docs/TESTS_README.md` une section **RBAC complet** avec 8 scénarios :
>
>   1. `tenantAdmin` invite un co-admin (+ 2FA) → OK.
>   2. Tentative de supprimer **dernier** `tenantAdmin` → KO (422).
>   3. `tenantAdmin` invite `buAdmin` pour BU-X → `buAdmin` voit uniquement BU-X.
>   4. `buAdmin` invite `buPrinterAdmin` → création/édition de PrinterEnv OK.
>   5. `buAdmin` invite `printerAdmin` (env individuel) → édition limitée, pas d’onglet admin.
>   6. `buProjectAdmin` invite `projectUser` → peut créer/éditer **ses** projets, pas ceux des autres.
>   7. Invitations JWT (read vs edit.testing) → respect des scopes, no publish.
>   8. Audit : toutes les actions remontent, liens contextuels OK.

---

## Prompt R11 — UI “Qui voit quoi ?” (transparence)

> **Objectif**
> Réduire les tickets support.
>
> **À faire**
>
> * Dans `Profile` : section **Mes rôles & périmètres** : tableau (tenant/BU/environnements) + actions autorisées.
> * Sur chaque page sensible, un **tooltip** “Pourquoi je ne vois pas ce bouton ?” listant le rôle requis.

---

### Remarques d’implémentation (bref)

* **Raisons d’avoir des sous-rôles BU (buPrinterAdmin/buPaperAdmin/buProjectAdmin)** : séparation des responsabilités achats/projets/production, conforme à ce que tu veux.
* **projectUser** : impose **ownership** fort des projets (champ `ownerId`), sinon tu vas ouvrir trop large.
* **Co-admins** : log + 2FA obligatoires, et **AtLeastOneAdmin** côté serveur (non négociable).
* **Partages JWT** : garde-les, mais pousse les **comptes** pour tout ce qui est récurrent (traçabilité & gestion).

Tu colles ces 11 prompts et tu obtiens une gestion utilisateurs **SaaS PLG** complète, parfaitement alignée avec tes profils et ton multi-BU.
