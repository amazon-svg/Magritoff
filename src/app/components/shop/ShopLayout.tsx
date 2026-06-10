/**
 * ShopLayout — S-REWORK-1 (refonte scope post-S2.1, validee Arnaud 2026-05-10).
 *
 * Chassis 1 colonne pour /shop/:slug (style design-handoff "01 Boutique
 * publique") :
 *   - Header sticky brande : logo + nom boutique + nav locale (Accueil /
 *     Catalogue / Mes commandes) + cart icon + user menu
 *   - Budget strip optionnel sous header (corporate, mock pour l'instant)
 *   - Pilules horizontales scrollables pour filtrer par gamme (remplace
 *     sidebar gauche S2.2). Style Moo : radius full, border 1px, active
 *     = bg-ink text-paper. Pattern explicite design-handoff §4.1.
 *   - Grille produits pleine largeur (1 col, plus de 3-col)
 *   - Drawer panier slide-right via Sheet shadcn (remplace sidebar droite
 *     + view='cart' pleine page). Width 420px desktop / full mobile.
 *
 * Anciennes regressions S2.1 :
 *   - 3 colonnes desktop (sidebar gammes / main / panier sticky) -> remplace
 *   - Drawer mobile pour sidebar gauche -> remplace par pilules (visible
 *     directement, pas de drawer secondaire)
 *
 * Theming inchange :
 *   - data-theme="dark" par defaut (tokens.css), override si shop.theme.mode
 *     === 'light'
 *   - CSS custom props --shop-primary / --shop-accent
 */

import { useState, type ReactNode } from "react";
import { ShoppingCart, X } from "lucide-react";
import type { Shop } from "../../contexts/ShopsContext";
import type { Gamme } from "../../utils/productEnrichment";
import { AuthMenu } from "../auth/AuthMenu";
import type { PortalView, BudgetInfo } from "./portal/types";
import { TEST_IDS } from "../../lib/testIds";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet";
import {
  resolveShopTheme,
  resolveShopBrandStyle,
  shouldShowCartBadge,
} from "./ShopLayout.helpers";

interface GammePill {
  slug: string;
  name: string;
  count?: number;
}

interface Props {
  shop: Shop;
  view: PortalView;
  onView: (v: PortalView) => void;
  cartCount: number;
  budget?: BudgetInfo;
  /** Pilules de gammes filtrables sous le header (S-REWORK-1). Optionnel. */
  gammes?: GammePill[];
  /** Set des slugs de gammes filtres actifs (multi). */
  activeGammeSlugs?: Set<string>;
  /** Toggle d'une gamme. */
  onToggleGamme?: (slug: string) => void;
  /** Contenu drawer panier (slide-right via Sheet). */
  cartDrawer?: ReactNode;
  /** Contenu principal (vue active : home/catalog/product/orders). */
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: PortalView; label: string }> = [
  { key: "home", label: "Accueil" },
  { key: "catalog", label: "Catalogue" },
  { key: "orders", label: "Mes commandes" },
];

export function ShopLayout({
  shop,
  view,
  onView,
  cartCount,
  budget,
  gammes,
  activeGammeSlugs,
  onToggleGamme,
  cartDrawer,
  children,
}: Props) {
  const { dataTheme, isDark } = resolveShopTheme(shop);
  const brandStyle = resolveShopBrandStyle(shop);
  const showCartBadge = shouldShowCartBadge(cartCount);

  // S-REWORK-1 — Drawer panier slide-right via Sheet shadcn (remplace
  // view='cart' page entiere). Ouvert par le cart icon du header.
  const [cartOpen, setCartOpen] = useState(false);

  const budgetPct = budget
    ? Math.min(100, Math.round((budget.used / budget.total) * 100))
    : 0;

  const hasGammes = gammes && gammes.length > 0;
  const activeFilters = activeGammeSlugs?.size ?? 0;

  // Affiche les pilules uniquement quand on est sur la vue catalog/home
  // (pas product/orders pour eviter le bruit visuel).
  const showGammePills = hasGammes && (view === "catalog" || view === "home");

  return (
    <div
      data-testid={TEST_IDS.shop.portal}
      data-theme={dataTheme}
      className={`min-h-screen ${isDark ? "bg-gray-950 text-gray-100" : "bg-bg text-ink"}`}
      style={{ ...brandStyle, fontFamily: "var(--font-ui)" }}
    >
      {/* ─── Header sticky brande ────────────────────────────────────── */}
      <header
        data-testid={TEST_IDS.shop.header}
        className={`sticky top-0 z-20 flex items-center gap-4 px-5 lg:px-9 py-3.5 border-b ${
          isDark ? "border-gray-800 bg-gray-950/95 backdrop-blur" : "border-line bg-paper"
        }`}
      >
        {/* Logo + nom + Magrit */}
        <div data-testid={TEST_IDS.shop.headerLogo} className="flex items-center gap-2.5">
          {shop.logo_url ? (
            <img
              src={shop.logo_url}
              alt={shop.name}
              className="h-6 w-6 object-contain rounded"
            />
          ) : (
            <div
              className="h-6 w-6 rounded"
              style={{
                background:
                  "linear-gradient(135deg, var(--shop-primary, #1e3a8a) 0%, var(--shop-accent, #f59e0b) 100%)",
              }}
            />
          )}
          <span className="text-[15px] font-medium">{shop.name}</span>
          <span
            className={`hidden sm:inline-block w-px h-[18px] mx-1 ${
              isDark ? "bg-gray-700" : "bg-line"
            }`}
          />
          <span
            className={`hidden sm:inline-block text-[13.5px] ${
              isDark ? "text-gray-400" : "text-ink-muted"
            }`}
          >
            × Magrit
          </span>
        </div>

        {/* Nav desktop */}
        <nav className="hidden md:flex gap-0.5 ml-4">
          {NAV_ITEMS.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onView(item.key)}
                className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  active
                    ? isDark
                      ? "bg-gray-800 text-gray-100 font-medium"
                      : "bg-bg text-ink font-medium"
                    : isDark
                      ? "text-gray-400 hover:bg-gray-800/60"
                      : "text-ink-2 hover:bg-bg/60"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Cart icon — ouvre drawer slide-right */}
        <button
          type="button"
          data-testid={TEST_IDS.shop.cartIcon}
          aria-label={`Panier (${cartCount} article${cartCount > 1 ? "s" : ""})`}
          onClick={() => setCartOpen(true)}
          className={`ml-auto relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] ${
            isDark
              ? "border-gray-800 bg-gray-900 text-gray-300 hover:text-gray-100"
              : "border-line bg-paper text-ink-2 hover:text-ink"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Panier</span>
          {showCartBadge && (
            <span
              className={`font-mono text-[10.5px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                isDark ? "bg-gray-100 text-gray-950" : "bg-ink text-paper"
              }`}
            >
              {cartCount}
            </span>
          )}
        </button>

        {/* User menu — Bug 2026-06-10 Arnaud : "je ne peux pas me déconnecter
            en tant que user". L'avatar inerte "U" est remplacé par AuthMenu
            (email connecté, espace actif, dashboard, changer d'espace,
            déconnexion). data-testid shop-header-user-menu conservé via le
            wrapper pour les cahiers de tests Notion. */}
        <div data-testid={TEST_IDS.shop.headerUserMenu}>
          <AuthMenu />
        </div>
      </header>

      {/* ─── Budget strip optionnel ──────────────────────────────────── */}
      {budget && (
        <div
          className={`hidden lg:flex items-center gap-8 px-9 py-3.5 border-b text-[13px] ${
            isDark
              ? "bg-gray-950 border-gray-800 text-gray-400"
              : "bg-bg border-line text-ink-muted"
          }`}
        >
          <span>
            Centre de coût ·{" "}
            <span className={`font-medium ${isDark ? "text-gray-100" : "text-ink"}`}>
              {budget.label}
            </span>
          </span>
          <span>
            Budget T4 ·{" "}
            <span
              className={`font-mono font-medium ${isDark ? "text-gray-100" : "text-ink"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {budget.used.toLocaleString("fr-FR")}€ / {budget.total.toLocaleString("fr-FR")}€
            </span>
          </span>
          <div
            className={`flex-1 max-w-[240px] h-1.5 rounded overflow-hidden relative ${
              isDark ? "bg-gray-800" : "bg-line"
            }`}
          >
            <div
              className="h-full rounded"
              style={{
                width: `${budgetPct}%`,
                background: "var(--shop-primary, var(--brand))",
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Pilules gammes (S-REWORK-1, style Moo) ──────────────────── */}
      {showGammePills && (
        <div
          data-testid={TEST_IDS.shop.gammesPills}
          className={`flex items-center gap-2 px-5 lg:px-9 py-3 border-b overflow-x-auto whitespace-nowrap scrollbar-thin ${
            isDark ? "bg-gray-950 border-gray-800" : "bg-paper border-line"
          }`}
          style={{ scrollbarWidth: "thin" }}
        >
          {/* "Tout" pill : aucune gamme active = tous les produits visibles */}
          <button
            type="button"
            data-testid={TEST_IDS.shop.gammePillAll}
            onClick={() => {
              // Click "Tout" : clear toutes les gammes actives
              if (activeGammeSlugs && onToggleGamme) {
                activeGammeSlugs.forEach((slug) => onToggleGamme(slug));
              }
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full border text-[12.5px] transition-colors ${
              activeFilters === 0
                ? isDark
                  ? "bg-gray-100 text-gray-950 border-gray-100"
                  : "bg-ink text-paper border-ink"
                : isDark
                  ? "bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-100"
                  : "bg-paper text-ink-2 border-line hover:text-ink"
            }`}
          >
            Tout
          </button>

          {gammes!.map((g) => {
            const active = activeGammeSlugs?.has(g.slug) ?? false;
            return (
              <button
                key={g.slug}
                type="button"
                data-testid={TEST_IDS.shop.gammePill}
                data-gamme-slug={g.slug}
                aria-pressed={active}
                onClick={() => onToggleGamme?.(g.slug)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12.5px] transition-colors ${
                  active
                    ? isDark
                      ? "bg-gray-100 text-gray-950 border-gray-100"
                      : "bg-ink text-paper border-ink"
                    : isDark
                      ? "bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-100"
                      : "bg-paper text-ink-2 border-line hover:text-ink"
                }`}
              >
                {g.name}
                {typeof g.count === "number" && g.count > 0 && (
                  <span
                    className={`font-mono ${active ? (isDark ? "text-gray-700" : "text-paper/70") : isDark ? "text-gray-500" : "text-ink-mute-2"}`}
                    style={{ fontSize: "10.5px", fontVariantNumeric: "tabular-nums" }}
                  >
                    {g.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Contenu principal pleine largeur ────────────────────────── */}
      <main
        data-testid={TEST_IDS.shop.productGrid}
        className="min-h-[calc(100vh-64px)]"
      >
        {children}
      </main>

      {/* ─── Drawer panier slide-right ───────────────────────────────── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent
          side="right"
          data-testid={TEST_IDS.shop.cartDrawer}
          className={`w-full sm:w-[420px] sm:max-w-[420px] p-0 ${
            isDark ? "bg-gray-950 text-gray-100 border-gray-800" : ""
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <SheetTitle className="text-[15px] font-medium m-0 p-0">
              Panier
              {cartCount > 0 && (
                <span
                  className={`ml-2 font-mono ${isDark ? "text-gray-500" : "text-ink-mute-2"}`}
                  style={{ fontSize: "12px", fontVariantNumeric: "tabular-nums" }}
                >
                  · {cartCount}
                </span>
              )}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              aria-label="Fermer le panier"
              className={`p-1.5 rounded-md ${
                isDark ? "text-gray-400 hover:text-gray-100" : "text-ink-2 hover:text-ink"
              }`}
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-65px)]">
            {cartDrawer ?? (
              <div className="p-5">
                <p
                  className={`text-[13px] m-0 ${isDark ? "text-gray-500" : "text-ink-muted"}`}
                  style={{ lineHeight: 1.55 }}
                >
                  Votre panier est vide. Ajoutez des produits depuis le catalogue.
                </p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
