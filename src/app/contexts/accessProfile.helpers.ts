/**
 * Décision d affichage d une capability à partir du profil d accès (UM2).
 *
 * Extraite du provider pour être testable (vitest tourne en environnement
 * node, sans testing-library — convention du dépôt, cf. CartContext).
 *
 * Reproduit la sémantique serveur de `user_has_capability` : super admin →
 * tout ; admin de l espace → tout ; sinon l union des rôles actifs. Ne sert
 * qu à montrer ou masquer — le serveur revérifie chaque action.
 */

import type { UserAccessProfile } from '../../modules/roles';

export function resolveCapability(
  profile: UserAccessProfile | null,
  loading: boolean,
  isSuperAdmin: boolean,
  capability: string,
): boolean | null {
  if (isSuperAdmin) return true;
  if (loading) return null;
  if (!profile) return false;
  return profile.isAdmin || profile.capabilities.includes(capability);
}
