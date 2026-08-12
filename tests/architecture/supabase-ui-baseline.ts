/**
 * Dette brownfield mesurée sur main au 2026-08-11 (commit eea7f56).
 *
 * Cette liste n'autorise pas Supabase dans le navigateur : elle empêche
 * seulement la dette historique d'augmenter pendant sa migration vers /api/v1.
 * Chaque story de migration doit supprimer les entrées devenues inutiles et
 * abaisser les compteurs ; la baseline ne doit jamais être augmentée.
 * Après AF15.2 : 20 fichiers importeurs et 67 références directes restantes.
 * Le compteur inclut les appels où `supabase` et `.` sont séparés par un saut de ligne.
 */
export const legacySupabaseUiImportFiles = new Set([
  'src/app/components/ChatInterface.tsx',
  'src/app/components/DiagnosticPanel.tsx',
  'src/app/components/dashboard/DashboardAdminMockups.tsx',
  'src/app/components/dashboard/InviteUserModalV2.tsx',
  'src/app/components/dashboard/commercial/DashboardCommercial.tsx',
  'src/app/components/dashboard/commercial/commercial.helpers.ts',
  'src/app/components/mockup/MockupImage.tsx',
  'src/app/components/shop/portal/AccountHub.tsx',
  'src/app/components/shop/portal/CheckoutPage.tsx',
  'src/app/components/shop/portal/PortalCatalog.tsx',
  'src/app/components/tenant/AcceptInvitation.tsx',
  'src/app/components/tenant/LegacySlugRedirect.tsx',
  'src/app/components/tenant/ShopOnlyRedirect.tsx',
  'src/app/contexts/AuthContext.tsx',
  'src/app/contexts/ConversationContext.tsx',
  'src/app/contexts/LibraryContext.tsx',
  'src/app/contexts/QuoteTemplatesContext.tsx',
  'src/app/contexts/QuotesContext.tsx',
  'src/app/hooks/useUserCapability.ts',
  'src/app/utils/quote.ts',
]);

export const legacySupabaseUiReferenceLimits = new Map<string, number>([
  ['src/app/components/ChatInterface.tsx', 1],
  ['src/app/components/DiagnosticPanel.tsx', 1],
  ['src/app/components/dashboard/commercial/DashboardCommercial.tsx', 10],
  ['src/app/components/dashboard/commercial/commercial.helpers.ts', 2],
  ['src/app/components/mockup/MockupImage.helpers.ts', 3],
  ['src/app/components/shop/portal/AccountHub.tsx', 1],
  ['src/app/components/shop/portal/CheckoutPage.tsx', 4],
  ['src/app/components/shop/portal/PortalCatalog.tsx', 3],
  ['src/app/components/tenant/AcceptInvitation.tsx', 3],
  ['src/app/components/tenant/LegacySlugRedirect.tsx', 1],
  ['src/app/components/tenant/ShopOnlyRedirect.tsx', 1],
  ['src/app/contexts/AuthContext.tsx', 1],
  ['src/app/contexts/ConversationContext.tsx', 3],
  ['src/app/contexts/LibraryContext.tsx', 12],
  ['src/app/contexts/QuoteTemplatesContext.tsx', 6],
  ['src/app/contexts/QuotesContext.tsx', 13],
  ['src/app/hooks/useUserCapability.ts', 1],
  ['src/app/utils/quote.ts', 1],
]);

export const legacyDirectEdgeUrlLimits = new Map<string, number>([
  ['src/app/components/ChatInterface.tsx', 1],
  ['src/app/components/mockup/MockupImage.helpers.ts', 1],
  ['src/app/components/shop/portal/PortalCatalog.tsx', 1],
]);
