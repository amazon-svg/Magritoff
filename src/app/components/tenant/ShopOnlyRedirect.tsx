/**
 * ShopOnlyRedirect
 * ────────────────
 * Composant utilitaire monte par TenantAwareLayout quand l'user a un
 * access_scope === 'shop_only'. Il :
 *   1. resout le slug de la premiere boutique autorisee
 *   2. redirige vers /shop/:slug
 *   3. affiche un message d'erreur si aucune boutique n'est utilisable
 *
 * Le composant retourne null pendant le loading. La redirection est faite
 * via <Navigate /> quand le slug est resolu.
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { supabase } from '/utils/supabase/client';

interface Props {
  allowedShopIds: string[];
}

export function ShopOnlyRedirect({ allowedShopIds }: Props) {
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (allowedShopIds.length === 0) {
      setError('Aucune boutique ne vous a ete attribuee. Contactez l\'administrateur de votre espace.');
      setLoading(false);
      return;
    }
    supabase
      .from('shops')
      .select('slug')
      .in('id', allowedShopIds)
      .limit(1)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Boutique introuvable. Contactez l\'administrateur de votre espace.');
        } else {
          setShopSlug(data.slug);
        }
        setLoading(false);
      });
  }, [allowedShopIds.join(',')]);

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg text-ink-muted"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 300 }}
      >
        Redirection vers votre boutique…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-bg text-ink-muted px-6"
        style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 300 }}
      >
        <div className="max-w-md text-center">
          <p className="text-ink mb-2" style={{ fontSize: '18px', fontWeight: 400 }}>
            Acces restreint
          </p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return <Navigate to={`/shop/${shopSlug}`} replace />;
}
