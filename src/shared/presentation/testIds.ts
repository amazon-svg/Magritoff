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
    /** Sprint 5 (raccourcis rail lateral) - acces rapides Projets / Devis depuis la home chat. */
    railProjectsLink: 'marguerite-rail-projects-link',
    railQuotesLink: 'marguerite-rail-quotes-link',
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
    // E10.10b-1 — onglet « Mes devis » /account/quotes (PortalQuotes)
    accountQuotesList: 'shop-account-quotes-list',
    accountQuotesEmpty: 'shop-account-quotes-empty',
    accountQuoteRow: 'shop-account-quote-row',
    accountQuoteDetail: 'shop-account-quote-detail',
    // E10.10b-2 — decision du client (accepter/refuser un devis, PortalQuotes)
    accountQuoteAcceptBtn: 'shop-account-quote-accept-btn',
    accountQuoteRejectBtn: 'shop-account-quote-reject-btn',
    accountQuoteDecisionConfirmModal: 'shop-account-quote-decision-confirm-modal',
    accountQuoteDecisionConfirmBtn: 'shop-account-quote-decision-confirm-btn',
    accountQuoteDecisionCancelBtn: 'shop-account-quote-decision-cancel-btn',
    accountQuoteDecisionError: 'shop-account-quote-decision-error',
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
    // Correctif qa-review B1 (2026-09-03) : badge de la LISTE (distinct de
    // `siretVerifyBtn`, dans la modale) — permet aux tests de verifier que
    // la ligne reflete bien `siret_verified` sans attendre un rechargement
    // manuel de page.
    siretVerifiedBadge: 'customer-siret-verified-badge',
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

    // ─── E10.9 — remises granulaires, tracabilite d audit et capacites
    // reprises de l ancien editeur de devis (ajout/suppression/
    // requantification/reordonnancement, decision d Arnaud du 01/09) ──────
    // `data-line-id` deja pose sur `lineRow` (ci-dessus) sert de cle pour
    // toutes les lignes ci-dessous, une seule fois pour toute la table.
    lineSalePriceInput: 'quote-line-sale-price-input',
    lineMarginInput: 'quote-line-margin-input',
    lineQuantityInput: 'quote-line-quantity-input',
    // `data-sign="positive"|"negative"` selon le signe de discount_rate.
    lineDiscountDisplay: 'quote-line-discount-display',
    lineImmutableCols: 'quote-line-immutable-cols',
    lineNegativeMarginWarning: 'quote-line-negative-margin-warning',
    lineMoveUpBtn: 'quote-line-move-up-btn',
    lineMoveDownBtn: 'quote-line-move-down-btn',
    lineDeleteBtn: 'quote-line-delete-btn',
    addLineBtn: 'quote-add-line-btn',
    addLineDrawer: 'quote-add-line-drawer',
    addLineProjectItemOption: 'quote-add-line-project-item-option',
    addLineFreeOption: 'quote-add-line-free-option',
    addLineFreeLabelInput: 'quote-add-line-free-label-input',
    addLineFreeQuantityInput: 'quote-add-line-free-quantity-input',
    addLineFreePriceInput: 'quote-add-line-free-price-input',
    addLineSubmitBtn: 'quote-add-line-submit-btn',
    // Panneau d audit (lecture seule), accessible depuis le devis (CA5, CA6).
    auditPanel: 'quote-audit-panel',
    auditRow: 'quote-audit-row', // `data-audit-id` sur chaque ligne.

    // ─── E10.10a — statut, envoi/renvoi, duplication, remise globale,
    // totaux serveur, TVA, validite par defaut, journal d entete ──────────
    statusBadge: 'quote-status-badge',
    readOnlyBanner: 'quote-read-only-banner',
    validityExpiredBanner: 'quote-validity-expired-banner',
    sourceQuoteBadge: 'quote-source-badge', // `data-source-quote-id` pose dessus.
    // Envoi / renvoi (`sendQuote`).
    sendBtn: 'quote-send-btn',
    sendDialog: 'quote-send-dialog',
    sendShowDiscountsCheckbox: 'quote-send-show-discounts-checkbox',
    sendConfirmBtn: 'quote-send-confirm-btn',
    sendCancelBtn: 'quote-send-cancel-btn',
    sendSuccessBanner: 'quote-send-success-banner',
    // Duplication (`duplicateQuote`).
    duplicateBtn: 'quote-duplicate-btn',
    // E10.12 — « bouton Valider » (`convertQuote`), visible pour un devis
    // `sent` ou `accepted` uniquement. Aucun controle metier ici (le serveur
    // tranche) : la confirmation demandee quand la source est `sent` est une
    // courtoisie d interface, pas une garde.
    convertBtn: 'quote-convert-btn',
    convertDialog: 'quote-convert-dialog',
    convertConfirmBtn: 'quote-convert-confirm-btn',
    convertCancelBtn: 'quote-convert-cancel-btn',
    convertSuccessBanner: 'quote-convert-success-banner',
    // Entete (show_discounts/valid_until) — formulaire E10.3, sans testid
    // jusqu ici.
    showDiscountsCheckbox: 'quote-show-discounts-checkbox',
    validUntilInput: 'quote-valid-until-input',
    headerSaveBtn: 'quote-header-save-btn',
    // Remise globale (`global_discount_rate` XOR `target_net_total`), miroir
    // du geste ligne (E10.9) : deux champs visibles, mutuellement exclusifs,
    // remise DEDUITE affichee a cote en lecture seule.
    globalDiscountRateInput: 'quote-global-discount-rate-input',
    globalDiscountTargetInput: 'quote-global-discount-target-input',
    globalDiscountClearBtn: 'quote-global-discount-clear-btn',
    globalDiscountDisplay: 'quote-global-discount-display',
    // TVA — surcharge par devis et taux/mention effectivement appliques.
    vatRateInput: 'quote-vat-rate-input',
    vatRateDisplay: 'quote-vat-rate-display',
    vatLegalMention: 'quote-vat-legal-mention',
    // Totaux serveur (`QuoteTotals`), jamais recalcules cote client.
    totalsPanel: 'quote-totals-panel',
    totalsLinesSubtotal: 'quote-totals-lines-subtotal',
    totalsGlobalDiscount: 'quote-totals-global-discount',
    totalsNetTotal: 'quote-totals-net-total',
    totalsVatAmount: 'quote-totals-vat-amount',
    totalsInclTax: 'quote-totals-incl-tax',
    // Journal d entete (`listQuoteHeaderAuditEntries`), garde par
    // `can_manage_pricing` — l onglet n est meme pas rendu sans ce droit.
    auditTabLines: 'quote-audit-tab-lines',
    auditTabHeader: 'quote-audit-tab-header',
    headerAuditPanel: 'quote-header-audit-panel',
    headerAuditRow: 'quote-header-audit-row', // `data-audit-id` sur chaque ligne.
  },

  // ─── E10.10a — Reglages commerciaux (validite par defaut des devis) ────
  commercialSettings: {
    defaultValiditySection: 'commercial-settings-default-validity-section',
    defaultValidityInput: 'commercial-settings-default-validity-input',
    defaultValiditySaveBtn: 'commercial-settings-default-validity-save-btn',
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

  // ─── E10.13 — Etapes de production configurables et ordonnancables (P13) ──
  // Ecran de parametrage atelier : creation, renommage, couleur, terminale,
  // activation/desactivation, glisser-deposer pour reordonner (CA1-CA7).
  // `data-step-id` pose sur `row` (meme convention que `pricing.row`/
  // `data-rule-id`). Testid mandates par la story Notion (Hints DOM) :
  // production-steps-page, production-step-row (+data-step-id),
  // production-step-add-btn, production-step-label-input,
  // production-step-drag-handle, production-step-deactivate-btn,
  // production-step-save-btn.
  productionStep: {
    page: 'production-steps-page',
    row: 'production-step-row',
    dragHandle: 'production-step-drag-handle',
    labelInput: 'production-step-label-input',
    colorSelect: 'production-step-color-select',
    terminalCheckbox: 'production-step-terminal-checkbox',
    saveBtn: 'production-step-save-btn',
    deactivateBtn: 'production-step-deactivate-btn',
    deleteBtn: 'production-step-delete-btn',
    addBtn: 'production-step-add-btn',
    addLabelInput: 'production-step-add-label-input',
    addSubmitBtn: 'production-step-add-submit-btn',
    errorBanner: 'production-step-error-banner',
  },

  // ─── E10.14 — Modale unifiee de changement de statut et historique ────────
  // UN SEUL composant (`OrderStatusDialog`), DEUX points d appel (bouton en
  // ligne de grille ET en fiche commande, CA1/CA2 : jamais deux
  // implementations, jamais d edition inline dans la grille). Ecran a DEUX
  // colonnes : historique horodate (gauche) / etapes du tenant (droite),
  // etape courante mise en evidence, etapes deja franchies distinguees
  // (`data-state`). Testid mandates par la story Notion (Hints DOM) :
  // order-status-btn, order-status-dialog, order-status-option
  // (+data-step-id, +data-state), order-status-confirm-btn,
  // order-status-history-panel, order-status-history-row (+data-history-id).
  orderStatus: {
    btn: 'order-status-btn',
    dialog: 'order-status-dialog',
    option: 'order-status-option',
    confirmBtn: 'order-status-confirm-btn',
    historyPanel: 'order-status-history-panel',
    historyRow: 'order-status-history-row',
    errorBanner: 'order-status-error-banner',
    closeBtn: 'order-status-close-btn',
  },

  // ─── E10.16 — Ecran de detail d une commande ───────────────────────────────
  // Fiche accessible par URL directe uniquement (aucune grille de commandes
  // dans ce lot, decision #7/reserve (f) du contrat, docs/api/CONVENTIONS.md
  // §8.17). CA1/CA2/CA4/CA6/CA7 ; CA3 (gamme de fabrication Clariprint), CA5
  // (fichiers, E10.17) et CA8 (PDF, E10.19) HORS PERIMETRE — aucun testid
  // n est pose pour eux (pas de lien mort). `order-line-row` porte
  // `data-line-id`. Le bouton Statut reutilise `TEST_IDS.orderStatus.btn`
  // (E10.14, cable ici pour la premiere fois).
  commercialOrder: {
    detailPage: 'order-detail-page',
    customerBlock: 'order-customer-block',
    linesTable: 'order-lines-table',
    lineRow: 'order-line-row',
  },

  // ─── E10.10b-4a — Gabarits PDF de documents (import et stockage) ───────────
  // Ecran de parametrage minimal : lister, importer, nommer, defaut, activer,
  // supprimer (CA de la sous-story 4a, docs/api/CONVENTIONS.md §8.18). PAS
  // d editeur de coordonnees (E10.10b-4b, hors perimetre). `data-template-id`
  // pose sur `row` (meme convention que `productionStep.row`/`data-step-id`).
  // Aucun cas de test Notion publie a la remise de ce lot (story nouvelle) :
  // testids poses selon la convention documentee en tete de ce fichier,
  // a faire confirmer par le scribe des que le cahier TF existera.
  documentTemplate: {
    page: 'document-template-page',
    row: 'document-template-row',
    nameInput: 'document-template-name-input',
    addNameInput: 'document-template-add-name-input',
    addDefaultCheckbox: 'document-template-add-default-checkbox',
    // E10.19a (qa-review B1) — choix du document_type a la creation, et
    // affichage du type dans la liste. Sans ces deux testids, aucun chemin
    // produit ne cree/ne distingue un gabarit `order`.
    addTypeSelect: 'document-template-add-type-select',
    typeBadge: 'document-template-type-badge',
    addBtn: 'document-template-add-btn',
    saveBtn: 'document-template-save-btn',
    fileInput: 'document-template-file-input',
    importBtn: 'document-template-import-btn',
    defaultBtn: 'document-template-default-btn',
    deactivateBtn: 'document-template-deactivate-btn',
    deleteBtn: 'document-template-delete-btn',
    statusBadge: 'document-template-status-badge',
    errorBanner: 'document-template-error-banner',
    // E10.10b-4b — editeur de coordonnees (wireframe
    // .design-handoff/wireframes/E10.10b-4b-editeur-coordonnees.md).
    fieldsEditBtn: 'document-template-fields-edit-btn',
  },
  // E10.10b-4b — editeur de correspondance coordonnees du gabarit PDF.
  // Aucun cas de test Notion publie a la remise de ce lot (story nouvelle) :
  // testids poses selon la convention documentee en tete de ce fichier et
  // les "Hints DOM" du wireframe §2, a faire confirmer par le scribe des que
  // le cahier TF existera.
  documentTemplateFields: {
    page: 'document-template-fields-page',
    backLink: 'document-template-fields-back-link',
    saveIndicator: 'document-template-fields-save-indicator',
    saveBtn: 'document-template-fields-save-btn',
    previewBtn: 'document-template-fields-preview-btn',
    exitPreviewBtn: 'document-template-fields-exit-preview-btn',
    previewLongCheckbox: 'document-template-fields-preview-long-checkbox',
    errorBanner: 'document-template-fields-error-banner',
    conflictDialog: 'document-template-fields-conflict-dialog',
    conflictReloadBtn: 'document-template-fields-conflict-reload-btn',
    discardDialog: 'document-template-fields-discard-dialog',
    discardConfirmBtn: 'document-template-fields-discard-confirm-btn',
    discardCancelBtn: 'document-template-fields-discard-cancel-btn',
    tabFields: 'document-template-fields-tab-fields',
    tabTable: 'document-template-fields-tab-table',
    pageTab: 'document-template-fields-page-tab',
    canvas: 'document-template-fields-canvas',
    paletteItem: 'document-template-fields-palette-item',
    placementLabel: 'document-template-fields-placement-label',
    settingsPanel: 'document-template-fields-settings-panel',
    fontFamilySelect: 'document-template-fields-font-family-select',
    fontStyleSelect: 'document-template-fields-font-style-select',
    fontSizeInput: 'document-template-fields-font-size-input',
    alignInput: 'document-template-fields-align-input',
    colorInput: 'document-template-fields-color-input',
    widthToggle: 'document-template-fields-width-toggle',
    widthInput: 'document-template-fields-width-input',
    maxLinesInput: 'document-template-fields-max-lines-input',
    removeFieldBtn: 'document-template-fields-remove-field-btn',
    insertTableBtn: 'document-template-fields-insert-table-btn',
    removeTableBtn: 'document-template-fields-remove-table-btn',
    rowHeightInput: 'document-template-fields-row-height-input',
    rowsPerPageInput: 'document-template-fields-rows-per-page-input',
    continuationPageSelect: 'document-template-fields-continuation-page-select',
    columnRow: 'document-template-fields-column-row',
    addColumnSelect: 'document-template-fields-add-column-select',
    removeColumnBtn: 'document-template-fields-remove-column-btn',
    previewOverlay: 'document-template-fields-preview-overlay',
    // qa-review R5 — rendu du tableau des lignes SUR LE CANVAS (ligne reelle
    // + ligne fictive + poignees de glisse), distinct de `columnRow` (ligne
    // du panneau de reglages `LinesTablePanel`, un DOM different).
    tableRowOnCanvas: 'document-template-fields-table-row-on-canvas',
    tableAnchorHandle: 'document-template-fields-table-anchor-handle',
    tableSpacingHandle: 'document-template-fields-table-spacing-handle',
  },

  // ─── E10.17b — Panneau de fichiers sur la fiche commande ───────────────────
  // Troisieme section de `OrderDetailPage.tsx` (arbitrage Arnaud 09/09/2026),
  // meme gabarit visuel que `commercialOrder.customerBlock`/`linesTable`.
  // `block` EXIGE tel quel par le contrat (docs/api/CONVENTIONS.md §8.19 §5) —
  // volontairement NON pose par E10.16 ("pas de lien mort") : c est ce lot qui
  // le declare. Wireframe : .design-handoff/wireframes/E10.17b-panneau-
  // fichiers-commande.md. Aucun cas de test Notion publie a la remise de ce
  // lot (sous-story nouvelle) : testid poses selon la convention documentee
  // en tete de ce fichier, a faire confirmer par le scribe des que le cahier
  // TF existera.
  orderFiles: {
    block: 'order-files-block',
    counter: 'order-files-counter',
    errorBanner: 'order-files-error-banner',
    retryLoadBtn: 'order-files-retry-load-btn',
    dropzone: 'order-files-dropzone',
    browseBtn: 'order-files-browse-btn',
    fileInput: 'order-files-file-input',
    emptyState: 'order-files-empty-state',
    // `row` porte `data-file-id`, meme convention que `documentTemplate.row`.
    row: 'order-files-row',
    rowError: 'order-files-row-error',
    retryUploadBtn: 'order-files-retry-upload-btn',
    // qa-review N3 (round 1) — ferme une carte d envoi en erreur (retirable
    // du plafond client sans attendre un rechargement de page).
    dismissUploadBtn: 'order-files-dismiss-upload-btn',
    progressBar: 'order-files-progress-bar',
    missingObjectIcon: 'order-files-missing-object-icon',
    visibilityToggle: 'order-files-visibility-toggle',
    visibilityOption: 'order-files-visibility-option',
    visibilityWarning: 'order-files-visibility-warning',
    downloadBtn: 'order-files-download-btn',
    deleteBtn: 'order-files-delete-btn',
    deleteDialog: 'order-files-delete-dialog',
    deleteConfirmBtn: 'order-files-delete-confirm-btn',
    deleteCancelBtn: 'order-files-delete-cancel-btn',
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
