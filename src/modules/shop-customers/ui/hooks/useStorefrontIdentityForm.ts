import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { StorefrontIdentityApiClient } from '@/modules/shop-customers';
import { useState, type FormEvent } from 'react';
import type { StorefrontSession } from '@/modules/shop-customers';

export type StorefrontIdentityFormMode = 'login' | 'registration' | 'recovery';

export function useStorefrontIdentityForm(
  shopSlug: string,
  onAuthenticated: (session: StorefrontSession) => void,
) {
  const api = useStorefrontApi(StorefrontIdentityApiClient);
  const [mode, setModeState] = useState<StorefrontIdentityFormMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryRequested, setRecoveryRequested] = useState(false);

  const setMode = (next: StorefrontIdentityFormMode) => {
    setModeState(next);
    setError(null);
    setRecoveryRequested(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'recovery') {
        await api.requestPasswordRecovery(shopSlug, { email });
        setRecoveryRequested(true);
      } else if (mode === 'registration') {
        onAuthenticated(await api.register(shopSlug, { email, fullName, password }));
      } else {
        onAuthenticated(await api.authenticate(shopSlug, { email, password }));
      }
    } catch {
      setError(mode === 'recovery'
        ? 'Demande impossible pour le moment. Réessayez plus tard.'
        : mode === 'registration'
          ? 'Création impossible : vérifiez vos informations ou connectez-vous si ce compte existe déjà.'
          : 'Connexion impossible : vérifiez votre email et votre mot de passe.');
    } finally {
      setBusy(false);
    }
  };

  return {
    mode, setMode, fullName, setFullName, email, setEmail, password, setPassword,
    busy, error, recoveryRequested, submit,
  } as const;
}
