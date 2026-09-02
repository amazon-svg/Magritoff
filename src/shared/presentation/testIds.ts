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
    legacyShopOnlyNotice: 'tenant-legacy-shop-only-notice',
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
    // E10.4 (Sprint 5, TF-165, parcours P13) — module Clients.
    sidebarCustomersLink: 'nav-sidebar-customers-link',
    // E10.1 (Sprint 5, parcours P13) — module Projets.
    sidebarProjectsLink: 'nav-sidebar-projects-link',
  },
  dashboard: {
    welcomeCard: 'dashboard-welcome-card',
    // S2.16 — Page "Devis en attente" (sous-menu de Devis, option C).
    // Retire au chantier d unification des devis (docs/api/CONVENTIONS.md
    // §8.10) : le nouveau systeme (commercial_quotes) n a pas d equivalent au
    // concept "en attente de validation" — pas de composant a re-tagger.
  },

  // ─── P02 — Gestion utilisateurs ───────────────────────────────────────
  user: {
    page: 'users-page',
    sectionMagrit: 'users-section-magrit',
    // E10.5 (Sprint 5, parcours P12) — l ecran Utilisateurs ne liste que les
    // membres internes du tenant (CA1), jamais un interlocuteur client
    // (customer_contacts, E10.4). Pose sur le meme conteneur que
    // `sectionMagrit`, cible du cahier de test Notion.
    sectionInternal: 'users-section-internal',
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
    // S-USERS-REFONTE Phase A (2026-05-25) : nouvelle section Rôles
    // (catalog + assignations matrix users × rôles).
    sectionRoles: 'users-section-roles',
    roleRow: 'user-role-row',
    assignmentRow: 'user-assignment-row',
    assignmentToggle: 'user-assignment-toggle',
    // S-USERS-REFONTE Phase A complement : modals Inviter/Permissions refaits.
    inviteRoleOption: 'user-invite-role-option',
    // Fix 2026-05-27 : scope d'accès + boutiques dans modal Inviter.
    inviteScopeShopOnly: 'user-invite-scope-shop-only',
    inviteScopeFull: 'user-invite-scope-full',
    inviteShopOption: 'user-invite-shop-option',
    // Fix 2026-05-27 : scope + boutiques dans modal Éditer rôles.
    editScopeShopOnly: 'user-edit-scope-shop-only',
    editScopeFull: 'user-edit-scope-full',
    editShopOption: 'user-edit-shop-option',
    editAccessSaveBtn: 'user-edit-access-save-btn',
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
    /** R2 (refacto 2026-05-11) - fix bug E4 : banner billing explicite au lieu de bascule demo silencieuse. */
    billingErrorBanner: 'marguerite-billing-error-banner',
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
    // S2.3 — ShopProductCard avec MockupImage parametrique (Epic 2)
    productCardConfigureBtn: 'product-card-configure-btn',
    productCardSelectCheckbox: 'product-card-select-checkbox',
    // S2.11 — Bandeau categorie couleur-code + picto famille (Epic 2 ext e-commerce)
    productCardCategoryBadge: 'product-card-category-badge',
    // S2.12 — Badges d'etat commercial calcules (Nouveau/Meilleure vente/Eco/Express)
    productCardCommercialBadge: 'product-card-commercial-badge',
    // S2.13 — Puces attributs PIM scan sur la card (format/grammage/finition...)
    productCardAttrChip: 'product-card-attr-chip',
    // S2.15 — Bloc Nouveautes sur la home boutique (derniers produits integres)
    homeNewProducts: 'shop-home-new-products',
    // S2.16 — Bloc "Votre panier en cours" sur la home boutique (reprise, option C)
    homeCartResume: 'shop-home-cart-resume',
    homeCartResumeBtn: 'shop-home-cart-resume-btn',
    // S2.18 — Mega-menu 2 niveaux illustre (Sprint E3 Navigation)
    megaMenu: 'shop-mega-menu',
    megaMenuFamily: 'shop-mega-menu-family',
    megaMenuPanel: 'shop-mega-menu-panel',
    megaMenuSubcat: 'shop-mega-menu-subcat',
    // S2.19 — Fil d Ariane + facettes legeres (format devient filtre)
    catalogBreadcrumb: 'shop-catalog-breadcrumb',
    catalogFacetFormat: 'shop-catalog-facet-format',
    catalogFacetPrice: 'shop-catalog-facet-price',
    catalogEmpty: 'shop-catalog-empty',
    catalogEmptyAskMagrit: 'shop-catalog-empty-ask-magrit',
    catalogResetFacets: 'shop-catalog-reset-facets',
    // S2.21 — Autocompletion recherche catalogue (produits + familles + fallback Magrit)
    catalogSearchMenu: 'shop-catalog-search-menu',
    catalogSearchOption: 'shop-catalog-search-option',
    catalogSearchAskMagrit: 'shop-catalog-search-ask-magrit',
    // S2.20 — Landing categorie editorialisee (titre + intro + sous-cats + best-sellers)
    catalogLanding: 'shop-catalog-landing',
    catalogLandingSubcat: 'shop-catalog-landing-subcat',
    catalogLandingBestseller: 'shop-catalog-landing-bestseller',
    // S2.2 — Sidebar gammes depliables persistantes (Epic 2)
    gammesList: 'shop-gammes-list',
    gammeRow: 'shop-gamme-row',
    gammeToggleBtn: 'shop-gamme-toggle-btn',
    gammesFilterBadge: 'shop-gammes-filter-badge',
    // S2.4 — ProductOverlay configuration Clariprint (Epic 2)
    productOverlay: 'shop-product-overlay',
    overlayCloseBtn: 'shop-overlay-close-btn',
    overlayPriceDisplay: 'shop-overlay-price-display',
    overlayPriceLoading: 'shop-overlay-price-loading',
    overlayErrorBanner: 'shop-overlay-error-banner',
    overlayRetryBtn: 'shop-overlay-retry-btn',
    overlayAddBtn: 'shop-overlay-add-btn',
    overlayCancelBtn: 'shop-overlay-cancel-btn',
    overlayOptionQuantity: 'shop-overlay-option-quantity',
    overlayOptionFormat: 'shop-overlay-option-format',
    overlayOptionPaper: 'shop-overlay-option-paper',
    overlayOptionFinishingFront: 'shop-overlay-option-finishing-front',
    overlayOptionFinishingVerso: 'shop-overlay-option-finishing-verso',
    overlayOptionPrinting: 'shop-overlay-option-printing',
    overlayOptionDorure: 'shop-overlay-option-dorure',
    // S2.4b — Bouton Editer atelier qui ouvre l'overlay (correctif scope persona primaire)
    productCardEditBtn: 'product-card-edit-btn',
    // S7.3 — Page gamme /shop/:slug/g/:gamme (Epic 7 gabarit boutique v2)
    gammePage: 'shop-gamme-page',
    gammePageTitle: 'shop-gamme-page-title',
    gammeBreadcrumb: 'shop-gamme-breadcrumb',
    gammeConfigurator: 'shop-gamme-configurator',
    gammeTopFormatChip: 'shop-gamme-top-format-chip',
    gammeQuantityTier: 'shop-gamme-quantity-tier',
    gammeStickyBar: 'shop-gamme-sticky-bar',
    gammeStickyPrice: 'shop-gamme-sticky-price',
    gammeStickyAddBtn: 'shop-gamme-sticky-add-btn',
    gammePriceSourceBadge: 'shop-gamme-price-source-badge',
    gammeAskMagrit: 'shop-gamme-ask-magrit',
    gammeEmptyState: 'shop-gamme-empty-state',
    // S7.4 — Éditorial PIM + produits liés sur la page gamme
    gammeEditorial: 'shop-gamme-editorial',
    gammeEditorialFaq: 'shop-gamme-editorial-faq',
    gammeRelated: 'shop-gamme-related',
    // S7.6 — Tuile gamme « dès X € » (home vitrine)
    gammeTile: 'shop-gamme-tile',
    gammeTileFloorPrice: 'shop-gamme-tile-floor-price',
    gammeTileNoPrice: 'shop-gamme-tile-no-price',
    // S7.11 — Mode d'accès acheteurs (BO éditeur boutique)
    accessModeSelect: 'shop-access-mode-select',
    // S7.12 — Checkout ≤ 2 écrans (identification + récap)
    checkoutPage: 'shop-checkout-page',
    checkoutIdentification: 'shop-checkout-identification',
    checkoutLoginTab: 'shop-checkout-login-tab',
    checkoutRegisterTab: 'shop-checkout-register-tab',
    checkoutFullNameInput: 'shop-checkout-full-name-input',
    checkoutEmailInput: 'shop-checkout-email-input',
    checkoutPasswordInput: 'shop-checkout-password-input',
    checkoutAuthBtn: 'shop-checkout-auth-btn',
    checkoutRequestAccess: 'shop-checkout-request-access',
    checkoutSubmitBtn: 'shop-checkout-submit-btn',
    // S7.10 — AccountHub « Mon compte » /account/*
    accountHub: 'shop-account-hub',
    accountTab: 'shop-account-tab',
    accountProfile: 'shop-account-profile',
    accountLogoutBtn: 'shop-account-logout-btn',
    // S7.9 — Bandeau Reprendre riche (home) + compact (pages gammes)
    resumeBanner: 'shop-resume-banner',
    resumeChipCart: 'shop-resume-chip-cart',
    resumeChipRenew: 'shop-resume-chip-renew',
    resumeChipTrack: 'shop-resume-chip-track',
    // S7.8 — Home vitrine (tuiles gammes + éditorial + footer)
    homeGammeGrid: 'shop-home-gamme-grid',
    homeEditorial: 'shop-home-editorial',
    homeFooter: 'shop-home-footer',
    // S7.7 — ShopChrome (réassurance + recherche header + panier montant)
    reassuranceStrip: 'shop-reassurance-strip',
    headerSearch: 'shop-header-search',
    headerSearchInput: 'shop-header-search-input',
    headerSearchMenu: 'shop-header-search-menu',
    headerSearchOption: 'shop-header-search-option',
    headerSearchAskMagrit: 'shop-header-search-ask-magrit',
    headerCartAmount: 'shop-header-cart-amount',
    // S-FIX-1 — Section SEO/GEO PIM dans l'onglet Fiche existant (correctif scope
    // 2026-05-10 : pas de nouvel onglet, enrichissement de Fiche uniquement).
    ficheSeoSection: 'product-card-fiche-seo-section',
    ficheCopyJsonBtn: 'product-card-fiche-copy-json-btn',
    // S-FIX-3 — Mes commandes connectees shop_orders (correctif vue Orders vide)
    ordersList: 'shop-orders-list',
    ordersRow: 'shop-orders-row',
    // S-DUAL-READ (Sprint 4 Phase 1, 2026-05-18) : marker point gris sur les
    // commandes cohort legacy shop_orders (vs v1.1 tenant_orders) — design
    // Sally H1-bis (point gris + sr-only + title fallback desktop).
    ordersRowLegacyMarker: 'shop-orders-row-legacy-marker',
    // S3.1 (Sprint 5, 2026-05-23) : OrderHistoryTable filtres + tri colonne.
    orderFilterStatus: 'order-filter-status',
    orderFilterPeriod: 'order-filter-period',
    orderFilterAmountMin: 'order-filter-amount-min',
    orderFilterReset: 'order-filter-reset',
    orderFilteredEmpty: 'order-filtered-empty',
    // Fix 2026-05-25 : filtre catégoriel (ex: Boutique sur DashboardOrders).
    orderFilterExtra: 'order-filter-extra',
    // Fix 2026-05-25 v2 : dropdown Combobox (cardinalité 30+ boutiques).
    orderFilterExtraPopover: 'order-filter-extra-popover',
    orderFilterExtraItem: 'order-filter-extra-item',
    orderSortHeaderDate: 'order-sort-header-date',
    orderSortHeaderClient: 'order-sort-header-client',
    orderSortHeaderTotalHt: 'order-sort-header-total-ht',
    orderSortHeaderTotalTtc: 'order-sort-header-total-ttc',
    // extra column triable (ex: Boutique sur DashboardOrders multi-boutiques)
    orderSortHeaderExtra: 'order-sort-header-extra',
    // S3.2-residual (Sprint 5, 2026-05-23) : hint quand can_order=false
    // empeche la creation de commande depuis le panier.
    cartNoCreateOrderHint: 'shop-cart-no-create-order-hint',
    // S3.3 (Sprint 5, 2026-05-23) : bouton Renouveler 1-clic + banner warnings.
    orderRenewBtn: 'shop-order-renew-btn',
    cartRenewalWarningsBanner: 'shop-cart-renewal-warnings-banner',
    cartRenewalWarningsDismissBtn: 'shop-cart-renewal-warnings-dismiss-btn',
    // S3.4 (Sprint 5, 2026-05-23) : annulation commande draft + modal AlertDialog.
    orderCancelBtn: 'shop-order-cancel-btn',
    // 2026-07-08 : édition commande draft (acheteur) — miroir éditeur de devis.
    orderEditBtn: 'shop-order-edit-btn',
    orderEditor: 'shop-order-editor',
    orderEditorSaveBtn: 'shop-order-editor-save-btn',
    orderEditorLineQty: 'shop-order-editor-line-qty',
    orderEditorLinePrice: 'shop-order-editor-line-price',
    cancelOrderDialog: 'shop-cancel-order-dialog',
    cancelOrderDialogKeep: 'shop-cancel-order-dialog-keep',
    cancelOrderDialogConfirm: 'shop-cancel-order-dialog-confirm',
    cancelOrderDialogError: 'shop-cancel-order-dialog-error',
    // Fix 2026-05-25 : validation commande draft → validated (admin tenant only,
    // débloque S3.3 Renouveler en permettant aux drafts d'arriver en validated).
    orderValidateBtn: 'shop-order-validate-btn',
    validateOrderDialog: 'shop-validate-order-dialog',
    validateOrderDialogKeep: 'shop-validate-order-dialog-keep',
    validateOrderDialogConfirm: 'shop-validate-order-dialog-confirm',
    validateOrderDialogError: 'shop-validate-order-dialog-error',
    // S-CONSO-3 (Sprint 4 Phase 2, 2026-05-18) : page de confirmation
    // commande PortalThankYou (UX Sally validee, parcours acheteur demo).
    thankYouPage: 'shop-thank-you-page',
    thankYouCtaCatalog: 'shop-thank-you-cta-catalog',
    thankYouCtaOrders: 'shop-thank-you-cta-orders',
    // S-CONSO-5 (Sprint 4 Phase 2, 2026-05-18) : Select shadcn tri grille
    // catalogue (Sally design — Pertinence / Prix asc / Prix desc / Nouveautes).
    catalogSortSelect: 'shop-catalog-sort-select',
    // S-FIX-4 — Bouton Personnaliser placeholder (Canva future S5.x)
    productCardPersonalizeBtn: 'product-card-personalize-btn',
    // S-REWORK-1 — Pilules gammes horizontales sous header (remplace sidebar S2.2)
    gammesPills: 'shop-gammes-pills',
    gammePill: 'shop-gamme-pill',
    gammePillAll: 'shop-gamme-pill-all',
    // Portail client : liste strictement limitée aux commandes du compte.
    ordersEmptyState: 'shop-orders-empty-state',
    orderValidateBtnRole: 'shop-order-validate-btn-role',
    orderRejectBtn: 'shop-order-reject-btn',
    orderRejectReasonInput: 'shop-order-reject-reason-input',
    orderRejectDialog: 'shop-order-reject-dialog',
    orderRejectDialogConfirm: 'shop-order-reject-dialog-confirm',
    orderRejectDialogCancel: 'shop-order-reject-dialog-cancel',
    orderProductionStartBtn: 'shop-order-production-start-btn',
    orderShippedBtn: 'shop-order-shipped-btn',
    orderExportMenu: 'shop-order-export-menu',
    orderExportPdfQuoteBtn: 'shop-order-export-pdf-quote-btn',
    orderExportPdfInvoiceBtn: 'shop-order-export-pdf-invoice-btn',
    orderExportCsvBtn: 'shop-order-export-csv-btn',
    orderNextStepIndicator: 'shop-order-next-step-indicator',
    // A4.1 (2026-06-15) — Bannière hero + tagline en tête de boutique publique.
    heroBanner: 'shop-hero-banner',
    heroTagline: 'shop-hero-tagline',
  },

  // ─── Workflow & rôles de commande (S-ORDER-ROLES-3-UI) ────────────────
  // Nouveau scope dédié à la page admin tenant /t/:slug/admin/order-roles
  // (catalog rôles + rail visuel + matrice assignations) et à la modale
  // partagée RoleEditorDialog (création + édition). Wireframes Sally
  // 2026-06-08 dans .design-handoff/wireframes/S-ORDER-ROLES-3-*.md.
  orderRole: {
    page: 'order-role-page',
    // Rail visuel haut de page
    workflowRail: 'order-role-workflow-rail',
    workflowRailCard: 'order-role-workflow-rail-card',
    // Catalog table
    catalogTable: 'order-role-catalog-table',
    catalogRow: 'order-role-catalog-row',
    catalogAddBtn: 'order-role-catalog-add-btn',
    catalogMenuBtn: 'order-role-catalog-menu-btn',
    catalogMenuEdit: 'order-role-catalog-menu-edit',
    catalogMenuDuplicate: 'order-role-catalog-menu-duplicate',
    catalogMenuMoveUp: 'order-role-catalog-menu-move-up',
    catalogMenuMoveDown: 'order-role-catalog-menu-move-down',
    catalogMenuArchive: 'order-role-catalog-menu-archive',
    catalogArchiveConfirmDialog: 'order-role-catalog-archive-confirm-dialog',
    catalogArchiveConfirmBtn: 'order-role-catalog-archive-confirm-btn',
    catalogShowArchivedBtn: 'order-role-catalog-show-archived-btn',
    // Bloc assignations (Option A : lecture seule + lien vers page Users)
    assignmentsSummary: 'order-role-assignments-summary',
    assignmentsManageLink: 'order-role-assignments-manage-link',
    // Statuts (placeholder V2)
    statusesSection: 'order-role-statuses-section',
    // Modale création / édition (RoleEditorDialog)
    editorDialog: 'order-role-editor-dialog',
    editorNameInput: 'order-role-editor-name-input',
    editorCapValidate: 'order-role-editor-cap-validate',
    editorCapCancel: 'order-role-editor-cap-cancel',
    editorCapModify: 'order-role-editor-cap-modify',
    editorCapExport: 'order-role-editor-cap-export',
    editorNotifyChainNext: 'order-role-editor-notify-chain-next',
    editorNotifyAllRoles: 'order-role-editor-notify-all-roles',
    editorNotifyNone: 'order-role-editor-notify-none',
    editorScopeTenant: 'order-role-editor-scope-tenant',
    editorScopeShop: 'order-role-editor-scope-shop',
    editorScopeShopCombobox: 'order-role-editor-scope-shop-combobox',
    editorScopeShopOption: 'order-role-editor-scope-shop-option',
    editorPositionSelect: 'order-role-editor-position-select',
    editorSubmitBtn: 'order-role-editor-submit-btn',
    editorCancelBtn: 'order-role-editor-cancel-btn',
    editorErrorBanner: 'order-role-editor-error-banner',
  },

  // ─── S2.32 — BO editeur boutique : mode PIM catalogue complet ──────────
  // Entree "PIM — Catalogue complet" dans DashboardShopEditor : radio maitre
  // (verse tout le catalogue product_library du tenant) + depliage des
  // gammes recensees avec selection/deselection par gamme.
  shopEditor: {
    pimToggle: 'shop-editor-pim-toggle',
    pimExpandBtn: 'shop-editor-pim-expand-btn',
    pimSelectAllBtn: 'shop-editor-pim-select-all-btn',
    // Prefixe : le slug de gamme est concatene inline (`${pimGamme}-${slug}`).
    pimGamme: 'shop-editor-pim-gamme',
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

  // ─── E10.4 — Module Clients (Sprint 5 Gestion commerciale, TF-165, P13) ──
  customer: {
    page: 'customers-page',
    table: 'customers-table',
    row: 'customer-row',
    createBtn: 'customer-create-btn',
    formModal: 'customer-form-modal',
    typeRadio: 'customer-type-radio',
    companyNameInput: 'customer-company-name-input',
    siretInput: 'customer-siret-input',
    siretVerifyBtn: 'customer-siret-verify-btn',
    saveBtn: 'customer-save-btn',
    detailPage: 'customer-detail-page',
    contactRow: 'customer-contact-row',
    contactAddBtn: 'customer-contact-add-btn',
    contactPrimaryToggle: 'customer-contact-primary-toggle',
    // E10.5 (Sprint 5, parcours P12) — ouverture/revocation explicite d un
    // acces boutique depuis la fiche client. `data-status` sur le badge vaut
    // "none" | "invited" | "active" (jamais "suspended" : un acces revoque
    // disparait de `shop_accesses`, cf. contrat OpenAPI).
    contactOpenShopAccessBtn: 'customer-contact-open-shop-access-btn',
    contactRevokeShopAccessBtn: 'customer-contact-revoke-shop-access-btn',
    contactShopAccessBadge: 'customer-contact-shop-access-badge',
  },

  // ─── E10.1 — Module Projets (Sprint 5 Gestion commerciale, parcours P13) ──
  // Le projet remplace le panier comme conteneur de travail sur les
  // surfaces internes Magrit (atelier, resultats de chiffrage). Structure de
  // page/detail prevue pour accueillir sans refonte les testid E10.3
  // (project-item-checkbox, project-create-quote-btn — hors perimetre E10.1).
  project: {
    page: 'projects-page',
    table: 'projects-table',
    row: 'project-row',
    createBtn: 'project-create-btn',
    createModal: 'project-create-modal',
    nameInput: 'project-name-input',
    customerSelect: 'project-customer-select',
    createSubmitBtn: 'project-create-submit-btn',
    detailPage: 'project-detail-page',
    itemRow: 'project-item-row',
    itemRemoveBtn: 'project-item-remove-btn',
    // CA1/CA4 — remplace le CTA "Ajouter au panier" sur les surfaces
    // internes (atelier, resultats de chiffrage, cf. QuoteDialog.tsx).
    addToProjectBtn: 'project-add-to-project-btn',
    addToProjectModal: 'project-add-to-project-modal',
    addToProjectExistingOption: 'project-add-to-project-existing-option',
    addToProjectCreateOption: 'project-add-to-project-create-option',
    addToProjectSubmitBtn: 'project-add-to-project-submit-btn',
    // ─── E10.2 — Tags libres colores sur les projets (Sprint 5) ─────────────
    // `tagInput`/`tagOption` : champ de saisie + autocompletion, cree a la
    // volee (CA2), pose dans l en-tete de la fiche projet (ProjectDetailPage).
    // `tagBadge`/`tagRemoveBtn` : affiche sur la ligne de la liste (lecture
    // seule) ET dans l en-tete du projet (CA6), avec un bouton de retrait
    // uniquement dans l en-tete (retrait du LIEN, jamais du tag du tenant,
    // CA5). `data-tag-id` pose sur chaque option/badge.
    tagInput: 'project-tag-input',
    tagOption: 'project-tag-option',
    tagBadge: 'project-tag-badge',
    tagRemoveBtn: 'project-tag-remove-btn',
    // Recherche et filtre de la liste des projets (CA4), sur ProjectsPage.
    searchInput: 'projects-search-input',
    tagFilter: 'projects-tag-filter',
    tagFilterOption: 'projects-tag-filter-option',
    // E10.3 — creation d un devis depuis un projet (CA1, CA2).
    createQuoteBtn: 'project-create-quote-btn',
    itemCheckbox: 'project-item-checkbox',
  },

  // ─── E10.3 — Creation d un devis depuis un projet (P13, TF-163) ────────
  commercialQuote: {
    createDrawer: 'quote-create-drawer',
    createSubmitBtn: 'quote-create-submit-btn',
    editorPage: 'quote-editor-page',
    numberDisplay: 'quote-number-display',
    lineRow: 'quote-line-row',
    // Ecran de liste (chantier d unification des devis, une seule IHM
    // "Devis" sur commercial_quotes — docs/api/CONVENTIONS.md §8.10).
    listPage: 'quote-list-page',
    listRow: 'quote-list-row',
    listStatusFilter: 'quote-list-status-filter',
    listSearchInput: 'quote-list-search-input',
    listDeleteBtn: 'quote-list-delete-btn',
    listDeleteConfirmBtn: 'quote-list-delete-confirm-btn',
    listDeleteDialog: 'quote-list-delete-dialog',
  },

  // ─── E10.6 — Referentiel des regles de prix (P13) ──────────────────────
  pricing: {
    page: 'pricing-rules-page',
    row: 'pricing-rule-row',
    createBtn: 'pricing-rule-create-btn',
    modal: 'pricing-rule-modal',
    scopeSelect: 'pricing-rule-scope-select',
    rangeSelect: 'pricing-rule-range-select',
    customerSelect: 'pricing-rule-customer-select',
    valueInput: 'pricing-rule-value-input',
    validFromInput: 'pricing-rule-valid-from-input',
    validToInput: 'pricing-rule-valid-to-input',
    saveBtn: 'pricing-rule-save-btn',
    statusPill: 'pricing-rule-status-pill',
    toggleActiveBtn: 'pricing-rule-toggle-active-btn',
    // CA5 (qa-review B1) — filtres client/gamme de la liste, distincts des
    // selects de portee du formulaire.
    customerFilterSelect: 'pricing-rules-customer-filter-select',
    rangeFilterSelect: 'pricing-rules-range-filter-select',
    // E10.7 CA7 — filtre par statut, recherche par nom et tri (creation /
    // debut de validite), poses sur les elements deja existants depuis
    // E10.6 qui n avaient pas encore de testid.
    statusFilterSelect: 'pricing-rules-status-filter',
    searchInput: 'pricing-rules-search-input',
    sortSelect: 'pricing-rules-sort-select',
    // CA5 (qa-review B1.5) — pagination explicite, jamais de troncature
    // silencieuse au-dela de la premiere page.
    loadMoreBtn: 'pricing-rules-load-more-btn',
    // CA4 (qa-review R2) — marge publique standard par gamme.
    defaultMarginSection: 'pricing-default-margin-section',
    defaultMarginRangeSelect: 'pricing-default-margin-range-select',
    defaultMarginInput: 'pricing-default-margin-input',
    defaultMarginSaveBtn: 'pricing-default-margin-save-btn',
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
