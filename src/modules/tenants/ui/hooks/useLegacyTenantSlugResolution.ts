import { useWorkspaceApi, useWorkspaceUiRuntime } from '@/platform/runtime/workspace-ui-runtime';
import { SessionApiClient } from '@/modules/session';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

export type LegacyTenantSlugTarget = string | null | undefined;

export function buildResolvedTenantPath({
  oldSlug,
  resolvedSlug,
  pathname,
  search,
  hash,
}: {
  oldSlug: string;
  resolvedSlug: string | null;
  pathname: string;
  search: string;
  hash: string;
}): string | null {
  if (!oldSlug || !resolvedSlug || resolvedSlug === oldSlug) return null;
  const oldPrefix = `/t/${oldSlug}`;
  const suffix = pathname === oldPrefix
    ? ''
    : pathname.startsWith(`${oldPrefix}/`)
      ? pathname.slice(oldPrefix.length)
      : '';
  return `/t/${resolvedSlug}${suffix}${search}${hash}`;
}

export function useLegacyTenantSlugResolution(oldSlug: string): LegacyTenantSlugTarget {
  const location = useLocation();
  const sessionApi = useWorkspaceApi(SessionApiClient);
  const [target, setTarget] = useState<LegacyTenantSlugTarget>(undefined);

  useEffect(() => {
    setTarget(undefined);
    if (!oldSlug) {
      setTarget(null);
      return;
    }
    let active = true;
    void sessionApi.resolveTenantSlug(oldSlug)
      .then((resolvedSlug) => {
        if (!active) return;
        setTarget(buildResolvedTenantPath({
          oldSlug,
          resolvedSlug,
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        }));
      })
      .catch(() => {
        if (active) setTarget(null);
      });
    return () => {
      active = false;
    };
  }, [location.hash, location.pathname, location.search, oldSlug, sessionApi]);

  return target;
}
