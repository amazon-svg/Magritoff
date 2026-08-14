/**
 * useUserCapability — une capability de l utilisateur dans l espace courant.
 *
 * UM2 (2026-08-14) : ne déclenche plus un appel réseau par capability. La
 * réponse vient du profil d accès partagé (AccessProfileContext), chargé une
 * fois par (utilisateur, espace) via l API `access-profile` du module roles.
 * La signature historique est conservée — les écrans n ont pas bougé.
 *
 * Usage type :
 *   const { hasIt, loading } = useUserCapability('can_validate');
 *   if (loading) return <Loader />;
 *   return hasIt ? <ValidateButton /> : null;
 *
 * Le profil ne sert qu à montrer ou masquer : le serveur revérifie chaque
 * action au moment de l exécuter.
 */

import { useAccessProfile } from '../contexts/AccessProfileContext';

export interface UseUserCapabilityResult {
  /** null pendant le chargement initial ; true/false sinon. */
  hasIt: boolean | null;
  loading: boolean;
  error: string | null;
}

export function useUserCapability(capability: string): UseUserCapabilityResult {
  const { hasCapability, loading, error } = useAccessProfile();
  return { hasIt: hasCapability(capability), loading, error };
}
