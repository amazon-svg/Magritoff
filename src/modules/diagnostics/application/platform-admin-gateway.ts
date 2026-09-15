import type { UserId } from '../../../kernel/ids/index.ts';

/**
 * BCP-0c (docs/api/CONVENTIONS.md §8.25, point 2.3ter) — verifie si l acteur
 * est administrateur de la plateforme, AVANT tout appel sortant facture
 * (Clariprint `CheckAuth`, Anthropic).
 *
 * La garde reelle est `public.is_super_admin()` (migration `20260424000100`) :
 * admin ou owner de l espace systeme `magrit-root`. Ce port reutilise cette
 * fonction SQL deja employee par les policies RLS et par
 * `SupabaseCatalogRepository.assertPimAdmin` (`catalog-repository.ts`) —
 * aucune reecriture de la regle « espace systeme » en TypeScript.
 */
export interface PlatformAdminGateway {
  isPlatformAdmin(actor: UserId): Promise<boolean>;
}
