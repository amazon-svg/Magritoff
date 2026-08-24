import { Outlet } from 'react-router';
import { useMemo } from 'react';
import { FetchApiClient } from '@/platform/api';
import { storefrontBrowserRuntime } from '@/platform/runtime/storefront-browser-runtime';
import {
  StorefrontUiRuntimeProvider,
  type StorefrontUiRuntime,
} from '@/platform/runtime/storefront-ui-runtime';

/** Composition exécutée uniquement pour les routes boutique. */
export function StorefrontRuntimeBoundary() {
  const value = useMemo<StorefrontUiRuntime>(() => {
    const apiClient = new FetchApiClient('', globalThis.fetch);
    return {
      apiClient,
      assistant: storefrontBrowserRuntime.assistant,
      clariprint: storefrontBrowserRuntime.createClariprint(apiClient),
    };
  }, []);

  return (
    <StorefrontUiRuntimeProvider value={value}>
      <Outlet />
    </StorefrontUiRuntimeProvider>
  );
}
