import { ApiClientError } from '@/platform/api';

export type ShopLoadFailure = 'not_found' | 'authentication_required' | 'unavailable';

export function classifyShopLoadFailure(
  cause: unknown,
  phase: 'probe' | 'catalog',
): ShopLoadFailure {
  if (!(cause instanceof ApiClientError)) return 'unavailable';
  if (cause.problem.status === 404) return 'not_found';
  if (phase === 'catalog' && (cause.problem.status === 401 || cause.problem.status === 403)) {
    return 'authentication_required';
  }
  return 'unavailable';
}
