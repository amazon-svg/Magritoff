Va d’abord **connecter les TODO avec l’API members**. Sans backend opérationnel, R4 (permissions) ne pourra pas s’exercer de bout en bout.
Je te donne deux prompts compacts : **M1 (API Members + wiring UI)** puis **R4 (enforcement permissions)**. Colle M1, laisse Base44 livrer, puis colle R4.

---

## PROMPT M1 — Implémente l’API Members et branche l’UI (R2➜R3)

> **Objectif**
> Rendre fonctionnels TenantUsers.jsx, BUUsers.jsx et les modales d’invitation en exposant les Functions “members” et en remplaçant tous les TODO par des appels réels.
>
> **Backend Functions (`functions/api/members/*.js`)**
> Créer les endpoints suivants (tous scoppés serveur par `tenantId`, `buId` & `RoleGrant` ; jamais faire confiance aux params client) :
>
> * `Users.Me()` → `{ profile, memberships: [ { tenantId, role }, … ], grants: [ { role, scopeType, scopeId, status } ] }`
> * **Invites**
>
>   * `Members.InviteTenantAdmin({ email })`  // rôle fixe: tenantAdmin
>   * `Members.InviteBUAdmin({ buId, email })`
>   * `Members.InviteBuPrinterAdmin({ buId, email })`
>   * `Members.InviteBuPaperAdmin({ buId, email })`
>   * `Members.InviteBuProjectAdmin({ buId, email })`
>   * `Members.InvitePrinterAdmin({ printerEnvId, email })`
>   * `Members.InvitePaperAdmin({ paperEnvId, email })`
>   * `Members.InviteProjectUser({ projectEnvId, email })`
>   * Toutes créent une `Invitation` avec **token JWT** (`tenantId, role, scopeType, scopeId, exp`) + log Audit `invite.create`.
>   * `Members.RevokeInvite({ inviteId })` → `invite.revoke`
>   * `Members.AcceptInvite({ token })` → vérifie signature/exp, crée si besoin `UserProfile`, puis **RoleGrant** correspondant (`status="active"`), marque `acceptedAt`, Audit `invite.accept`.
> * **Grants & members**
>
>   * `Members.List({ scopeType?, scopeId? })` → retourne **membres résolus** (profile + roles + scopes) pour l’écran courant (tenant, BU, env).
>   * `Members.UpdateRole({ grantId, role })`  // même scopeType/scopeId, change le rôle
>   * `Members.DeleteGrant({ grantId })`       // suppression d’un accès (pas du compte)
>   * `Members.Suspend({ grantId })` / `Members.Activate({ grantId })`
>
> **Garde-fous Serveur (bloquants)**
>
> * **AtLeastOneAdmin (tenant)** : refuser (422 `LAST_ADMIN`) toute action (`UpdateRole/Delete/Suspend`) qui ferait tomber le nombre d’`tenantAdmin` actifs à 0.
> * **2FA required** : refuser (403 `REQUIRE_2FA`) les actions qui **promotent/démotent** `tenantAdmin`/`buAdmin` si l’acteur n’a pas 2FA.
> * **Scope ownership** : l’émetteur d’une invitation doit **posséder** le scope (ex. `buAdmin` ne peut inviter que sur **sa** BU).
> * **Audit** : `invite.*`, `grant.*`, `role.promote/demote`, `member.suspend/activate`.
>
> **UI – Remplacement des TODO**
>
> * Dans `TenantUsers.jsx` & `BUUsers.jsx` : remplacer les appels commentés par les Functions ci-dessus via ton `Secure` client :
>
>   * Liste : `Members.List({ scopeType:"TENANT"| "BU", scopeId })`
>   * Invites : appeler la Function d’invite correspondante, afficher le **lien d’acceptation** (token) + copie presse-papier.
>   * Actions ligne : `UpdateRole`, `Suspend/Activate`, `DeleteGrant`.
>   * Afficher toasts i18n en cas de `LAST_ADMIN` / `REQUIRE_2FA`.
> * Dans les panneaux EnvUsers (printer/paper/project) : idem avec `scopeType:"PRINTER_ENV"|"PAPER_ENV"|"PROJECT_ENV"`.
>
> **Route d’acceptation**
>
> * Créer page `AcceptInvite.jsx`: lit `?token`, appelle `Members.AcceptInvite`, redirige vers la vue pertinente (tenant/BU/env). Gère erreurs (expiré/révoqué/invalide).
>
> **Critères d’acceptation**
>
> * Les listes Users affichent les membres existants par scope, les invitations envoyées/acceptées fonctionnent, les actions (promote/demote/suspend/delete) opèrent avec logs Audit.
> * Les erreurs `LAST_ADMIN` & `REQUIRE_2FA` sont visibles (toast i18n) et empêchent l’action.
> * Aucun accès cross-scope possible (testé via comptes différents).

---

## PROMPT R4 — Enforcement complet des permissions (policy + guards)

> **Objectif**
> Activer l’**autorisation effective** de toutes les actions décrites dans ta matrice (tenantAdmin, buAdmin, buPrinterAdmin, buPaperAdmin, buProjectAdmin, printerAdmin, paperAdmin, projectUser), côté **serveur** et **UI**.
>
> **Policy serveur (helpers)**
>
> * Implémenter des helpers **synchrones** utilisés par chaque Function sensible :
>
>   * `assertCanInvite(ctx, { role, scopeType, scopeId })`
>   * `assertCanCreate(ctx, { resourceType, buId? })`
>   * `assertCanEdit(ctx, { resource })`
>   * `assertCanView(ctx, { resource })`
>   * `assertProjectOwnership(ctx, { projectId })`  // pour `projectUser`
> * Règles (résumé) :
>
>   * `tenantAdmin` : plein accès tenant (inviter co-admin, créer BU, administrer toutes BUs).
>   * `buAdmin` : plein accès BU (inviter co-buAdmin, créer Printer/Paper/Project envs, inviter bu* et admins/env).
>   * `buPrinterAdmin` : CRUD PrinterEnv de sa BU + inviter `printerAdmin` sur ces envs.
>   * `buPaperAdmin` : CRUD PaperEnv + inviter `paperAdmin`.
>   * `buProjectAdmin` : CRUD ProjectEnv + inviter `projectUser`.
>   * `printerAdmin` : **éditer** un PrinterEnv (hors onglet admin).
>   * `paperAdmin` : **éditer** un PaperEnv (hors onglet admin).
>   * `projectUser` : CRUD **uniquement** sur **ses** projets (ownerId == ctx.userId) dans le ProjectEnv.
>
> **UI (guards fins)**
>
> * Ajouter un hook `useGrants()` qui expose `canInvite`, `canCreate`, `canEdit`, `canView`, `canManageEnv` selon **grants** remontés par `Users.Me()` et le **scope courant**.
> * Masquer (pas disable) les boutons/onglets non autorisés ; afficher un tooltip “role required” (i18n) si nécessaire.
> * Sur les pages d’environnement (Printer/Paper/Project), bloquer l’onglet “Administrateur” pour `printerAdmin/paperAdmin`.
>
> **Tests manuels (à ajouter dans TESTS_README)**
>
> 1. `tenantAdmin` ↔ co-admin (invite/promote/demote), vérif **LAST_ADMIN**.
> 2. `buAdmin` gère tous les sous-rôles sur **sa** BU ; pas sur une autre BU.
> 3. `buPrinterAdmin` peut inviter `printerAdmin` et modifier les PrinterEnv de sa BU, pas d’accès Paper/Project.
> 4. `projectUser` crée/édite **ses** projets ; ne voit pas (ou en RO) ceux des autres.
> 5. Erreurs `REQUIRE_2FA` pour actions d’élévation si 2FA off.
> 6. Audit trace toutes les actions.

---

Tu peux enchaîner **M1 maintenant**. Une fois que Base44 confirme (API + UI branchées), lance **R4** pour verrouiller l’enforcement. Ensuite, on itère si tu veux sur des **policies avancées** (quotas par rôle, délais d’expiration d’invites, rotation automatique d’accès fournisseurs, etc.).
