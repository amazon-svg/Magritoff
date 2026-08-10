# Module plateforme `identity`

**Statut :** candidate  
**Version :** 0.1

## Responsabilité

Répondre à la question « qui est l'appelant ? » : authentification, validation de session, identité globale et profil de compte.

## Non-responsabilités

- appartenance à un tenant ;
- rôles et capabilities ;
- entitlements commerciaux ;
- règles Clariprint Data ;
- accès direct depuis un module aux tables Supabase Auth.

## Contrat public

```ts
export interface IdentityService {
  verifyToken(token: string): Promise<Result<AuthenticatedIdentity, IdentityError>>;
  getCurrentIdentity(session: IdentitySession): Promise<Result<UserIdentity, IdentityError>>;
  getIdentity(userId: UserId): Promise<Result<UserIdentity | null, IdentityError>>;
}

export type UserIdentity = Readonly<{
  id: UserId;
  email?: string;
  displayName?: string;
  status: "active" | "disabled";
}>;
```

## Adaptateur initial

L'implémentation initiale encapsule Supabase Auth. Les types `Session` ou `User` Supabase ne traversent pas le contrat public.

`SupabaseIdentityService` est un adaptateur **serveur uniquement** : la
validation de token utilise `auth.getUser(token)` et la résolution d'une
identité tierce utilise l'API admin avec un client configuré côté serveur. Il
ne doit jamais être composé avec une clé de service dans le bundle navigateur.

## Erreurs

- `identity.invalid_token` ;
- `identity.session_expired` ;
- `identity.not_authenticated` ;
- `identity.disabled` ;
- `identity.provider_unavailable`.

## Sécurité

- aucun token brut dans les logs ;
- les modules reçoivent une identité déjà vérifiée ;
- un compte désactivé ne produit pas d'`ActorContext` utilisateur ;
- l'élévation super-administrateur ne fait pas partie de l'identité.

## Critères d'acceptation

- [x] `IDN-VAL-01` Aucun type Supabase Auth n'est exporté.
- [x] `IDN-VAL-02` Un token invalide ou expiré produit une erreur stable.
- [x] `IDN-VAL-03` Un utilisateur authentifié n'est pas automatiquement membre d'un tenant.
- [x] `IDN-VAL-04` Les logs ne contiennent ni token ni secret.
- [x] `IDN-VAL-05` L'adaptateur peut être remplacé par un double en test.
