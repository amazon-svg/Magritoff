/**
 * E7.7 — Central des data-testid Magrit B4
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Source unique des identifiants stables utilises par les cahiers de tests
 * fonctionnels (Notion 🧪 Cahiers de tests fonctionnels Magrit) et joues
 * par Claude in Chrome via MCP. Voir SPEC_data-testid_06052026.md pour la
 * convention complete.
 *
 * Format : `<scope>-<element>[-<modifier>]`. Une fois publie, un testid ne
 * se renomme plus a la legere : dual-tag pendant 1 sprint, mise a jour des
 * cahiers Notion, puis suppression de l ancien.
 */

export const TEST_IDS = {
  // ─── P00 — Creation espace tenant ─────────────────────────────────────
  tenant: {
    createForm: 'tenant-create-form',
    nameInput: 'tenant-name-input',
    slugInput: 'tenant-slug-input',
    sirenInput: 'tenant-siren-input',
    sirenVerifyBtn: 'tenant-siren-verify-btn',
    sirenStatusBadge: 'tenant-siren-status-badge',
    sirenInfo: 'tenant-siren-info',
    createSubmitBtn: 'tenant-create-submit-btn',
    // P04 — renommer espace
    settingsSection: 'tenant-settings-section',
    nameEditInput: 'tenant-name-edit-input',
    slugEditInput: 'tenant-slug-edit-input',
    renameWarningBanner: 'tenant-rename-warning-banner',
    renameSaveBtn: 'tenant-rename-save-btn',
    renameConfirmModal: 'tenant-rename-confirm-modal',
    renameConfirmBtn: 'tenant-rename-confirm-btn',
  },

  // ─── P00, P01 — Auth ──────────────────────────────────────────────────
  auth: {
    signupEmailInput: 'auth-signup-email-input',
    emailWarningBanner: 'auth-email-warning-banner',
    loginEmailInput: 'auth-login-email-input',
    loginPasswordInput: 'auth-login-password-input',
    loginSubmitBtn: 'auth-login-submit-btn',
  },

  // ─── P01 — Navigation post-login ──────────────────────────────────────
  nav: {
    sidebar: 'nav-sidebar',
    sidebarUsersLink: 'nav-sidebar-users-link',
    sidebarAtelierLink: 'nav-sidebar-atelier-link',
    sidebarConfigLink: 'nav-sidebar-config-link',
    sidebarProfileLink: 'nav-sidebar-profile-link',
    tenantSwitcher: 'nav-tenant-switcher',
  },
  dashboard: {
    welcomeCard: 'dashboard-welcome-card',
  },

  // ─── P02 — Gestion utilisateurs ───────────────────────────────────────
  user: {
    page: 'users-page',
    sectionMagrit: 'users-section-magrit',
    sectionCrm: 'users-section-crm',
    table: 'users-table',
    row: 'user-row',
    roleSelect: 'user-role-select',
    editPermissionsBtn: 'user-edit-permissions-btn',
    removeBtn: 'user-remove-btn',
    removeConfirmModal: 'user-remove-confirm-modal',
    removeConfirmBtn: 'user-remove-confirm-btn',
    removeCancelBtn: 'user-remove-cancel-btn',
    inviteBtn: 'user-invite-btn',
    inviteModal: 'user-invite-modal',
    inviteEmailInput: 'user-invite-email-input',
    inviteRoleSelect: 'user-invite-role-select',
    inviteSubmitBtn: 'user-invite-submit-btn',
    inviteLinkDisplay: 'user-invite-link-display',
    inviteLinkCopyBtn: 'user-invite-link-copy-btn',
    invitationRow: 'user-invitation-row',
    invitationRevokeBtn: 'user-invitation-revoke-btn',
    invitationResendBtn: 'user-invitation-resend-btn',
    // P03 — droits granulaires
    permissionsModal: 'user-permissions-modal',
    accessScopeRadio: 'user-access-scope-radio',
    allowedShopsMultiselect: 'user-allowed-shops-multiselect',
    allowedShopOption: 'user-allowed-shop-option',
    permissionCanQuoteCheckbox: 'user-permission-can-quote-checkbox',
    permissionCanOrderCheckbox: 'user-permission-can-order-checkbox',
    permissionCanInviteCheckbox: 'user-permission-can-invite-checkbox',
    permissionsSaveBtn: 'user-permissions-save-btn',
  },

  // ─── P05 / P06 — Marguerite (chat) ────────────────────────────────────
  marguerite: {
    chat: 'marguerite-chat',
    messageInput: 'marguerite-message-input',
    sendBtn: 'marguerite-send-btn',
    modeToggle: 'marguerite-mode-toggle',
    message: 'marguerite-message',
    hypothesesBanner: 'marguerite-hypotheses-banner',
    clarificationBubble: 'marguerite-clarification-bubble',
    quoteResult: 'marguerite-quote-result',
    quoteLine: 'marguerite-quote-line',
    quoteLineQuantityInput: 'marguerite-quote-line-quantity-input',
    quoteLineFormatSelect: 'marguerite-quote-line-format-select',
    quoteLineRemoveBtn: 'marguerite-quote-line-remove-btn',
    contextTruncatedIndicator: 'marguerite-context-truncated-indicator',
  },

  // ─── P07 — Tracking conso IA ──────────────────────────────────────────
  usage: {
    quotaCounter: 'usage-quota-counter',
    quotaProgressBar: 'usage-quota-progress-bar',
    quotaWarningBanner: 'usage-quota-warning-banner',
    quotaBlockedModal: 'usage-quota-blocked-modal',
    quotaUpgradeBtn: 'usage-quota-upgrade-btn',
    adminDashboard: 'admin-usage-dashboard',
  },

  // ─── P08 — Devis Clariprint ───────────────────────────────────────────
  quote: {
    priceDisplay: 'quote-price-display',
    priceLoading: 'quote-price-loading',
    priceErrorBanner: 'quote-price-error-banner',
    anomalyBanner: 'quote-anomaly-banner',
    refreshBtn: 'quote-refresh-btn',
  },

  // ─── P09 — Boutique portail B2B ───────────────────────────────────────
  shop: {
    portal: 'shop-portal',
    header: 'shop-header',
    headerLogo: 'shop-header-logo',
    headerUserMenu: 'shop-header-user-menu',
    productGrid: 'shop-product-grid',
    productCard: 'product-card',
    productCardQuoteBtn: 'product-card-quote-btn',
    productCardOrderBtn: 'product-card-order-btn',
    cartIcon: 'shop-cart-icon',
    cartDrawer: 'shop-cart-drawer',
    checkoutBtn: 'shop-checkout-btn',
    // S2.1 — ShopLayout 3 colonnes (Epic 2)
    navGammes: 'shop-nav-gammes',
    cartSticky: 'shop-cart-sticky',
    forbidden403: 'shop-forbidden-403',
  },

  // ─── Mockup engine parametrique (S4.3, Epic 4) ─────────────────────────
  // Composant <MockupImage> consomme l edge function mockup-generator (S4.1c)
  // avec fallback graceful (URL CDN public direct, edge function fetch sur
  // onError, ProductMockup SVG en fallback ultime).
  mockup: {
    productImage: 'mockup-product-image',
    productImageSkeleton: 'mockup-product-image-skeleton',
    productImageImg: 'mockup-product-image-img',
    productImageFallback: 'mockup-product-image-fallback',
  },
} as const;

/**
 * Aplatit l enum en un Set de tous les testid pour le smoke test.
 * Utilise par tests/data-testid.smoke.spec.ts.
 */
export function getAllTestIds(): string[] {
  const ids: string[] = [];
  for (const scope of Object.values(TEST_IDS)) {
    for (const id of Object.values(scope)) {
      if (typeof id === 'string') ids.push(id);
    }
  }
  return ids;
}
