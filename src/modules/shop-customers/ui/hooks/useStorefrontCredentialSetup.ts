import { useStorefrontApi, useStorefrontUiRuntime } from '@/platform/runtime/storefront-ui-runtime';
import { StorefrontIdentityApiClient } from '@/modules/shop-customers';
import { useState, type FormEvent } from 'react';

export function useStorefrontCredentialSetup({
  token,
  kind,
  onActivated,
}: {
  token: string;
  kind: 'activation' | 'recovery';
  onActivated?: () => void;
}) {
  const api = useStorefrontApi(StorefrontIdentityApiClient);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError(kind === 'activation'
        ? 'Ce lien d’activation est incomplet. Demandez une nouvelle invitation.'
        : 'Ce lien de récupération est incomplet. Demandez un nouveau lien.');
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'activation') {
        await api.activate({ token, password });
        onActivated?.();
      } else {
        await api.resetPassword({ token, password });
        setDone(true);
      }
    } catch {
      setError(kind === 'activation'
        ? 'Ce lien est invalide, expiré ou déjà utilisé. Demandez une nouvelle invitation.'
        : 'Ce lien est invalide, expiré ou déjà utilisé.');
    } finally {
      setBusy(false);
    }
  };

  return {
    password, setPassword, confirmation, setConfirmation,
    busy, done, error, submit,
  } as const;
}
