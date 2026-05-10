/**
 * ShopLayout — Story S2.1 (Epic 2 Boutique B2B Premium).
 *
 * Chassis 3 colonnes pour /shop/:slug :
 *   - Header sticky en haut : logo brande + nom boutique + nav locale +
 *     cart icon + user menu (+ menu mobile pour drawer gauche).
 *   - Budget strip optionnel sous header (corporate, mock pour l'instant).
 *   - Grid 3 colonnes desktop (lg+) : sidebar gauche (gammes, S2.2 future) /
 *     main (children, grille produits S2.3 future) / sidebar droite (panier
 *     sticky, S2.6+ future).
 *   - Mobile (< lg) : main pleine largeur, sidebars gauche/droite via Sheet
 *     drawers shadcn ([src/app/components/ui/sheet.tsx]).
 *
 * Theming :
 *   - data-theme="dark" par defaut (tokens.css L106-118), override si
 *     shop.theme.mode === 'light' (cf. resolveShopTheme).
 *   - CSS custom props --shop-primary / --shop-accent exposees au shop
 *     root pour theming dynamique tenant.
 *
 * Replace : PortalChrome + viewSwitcher 1-col actuels dans PublicShop.tsx.
 * Les vues PortalHome/Catalog/Product/Cart sont conservees comme `children`
 * placeholders MVP — elles seront refondues par S2.2 / S2.3 / S2.7.
 */

import { useState, type ReactNode } from "react";
import { Menu, ShoppingCart } from "lucide-react";
import type { Shop } from "../../contexts/ShopsContext";
import type { PortalView, BudgetInfo } from "./portal/types";
import { TEST_IDS } from "../../lib/testIds";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  resolveShopTheme,
  resolveShopBrandStyle,
  shouldShowCartBadge,
} from "./ShopLayout.helpers";

interface Props {
  shop: Shop;
  view: PortalView;
  onView: (v: PortalView) => void;
  cartCount: number;
  budget?: BudgetInfo;
  /** Contenu sidebar gauche (gammes navigation — S2.2 future). MVP = placeholder. */
  leftSidebar?: ReactNode;
  /** Contenu sidebar droite (panier sticky — S2.6+ future). MVP = mini-recap panier. */
  rightSidebar?: ReactNode;
  /** Contenu colonne centrale (vue active : home/catalog/product/cart/orders). */
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
  leftSidebar,
  rightSidebar,
  children,
}: Props) {
  const { dataTheme, isDark } = resolveShopTheme(shop);
  const brandStyle = resolveShopBrandStyle(shop);
  const showCartBadge = shouldShowCartBadge(cartCount);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const budgetPct = budget
    ? Math.min(100, Math.round((budget.used / budget.total) * 100))
    : 0;

  return (
    <div
      data-testid={TEST_IDS.shop.portal}
      data-theme={dataTheme}
      className={`min-h-screen ${isDark ? "bg-gray-950 text-gray-100" : "bg-bg text-ink"}`}
      style={{
        ...brandStyle,
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* ─── Header sticky brande ────────────────────────────────────── */}
      <header
        data-testid={TEST_IDS.shop.header}
        className={`sticky top-0 z-20 flex items-center gap-4 px-5 lg:px-9 py-3.5 border-b ${
          isDark ? "border-gray-800 bg-gray-950/95 backdrop-blur" : "border-line bg-paper"
        }`}
      >
        {/* Bouton menu mobile (ouvre sidebar gauche) */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Ouvrir la navigation des gammes"
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-line/40"
            >
              <Menu className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className={`w-[280px] sm:w-[320px] ${isDark ? "bg-gray-950 text-gray-100 border-gray-800" : ""}`}
          >
            <SheetTitle className="px-4 pt-4 text-sm font-medium">Gammes</SheetTitle>
            <div className="p-4">{leftSidebar}</div>
          </SheetContent>
        </Sheet>

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
        <nav className="hidden md:flex gap-0.5 ml-2">
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

        {/* Cart icon — desktop ouvre vue cart, mobile ouvre drawer panier */}
        <button
          type="button"
          data-testid={TEST_IDS.shop.cartIcon}
          aria-label={`Panier (${cartCount} article${cartCount > 1 ? "s" : ""})`}
          onClick={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) {
              onView("cart");
            } else {
              setMobileCartOpen(true);
            }
          }}
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

        {/* Drawer panier mobile */}
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetContent
            side="right"
            className={`w-[320px] sm:w-[380px] ${isDark ? "bg-gray-950 text-gray-100 border-gray-800" : ""}`}
          >
            <SheetTitle className="px-4 pt-4 text-sm font-medium">Panier</SheetTitle>
            <div className="p-4">{rightSidebar}</div>
          </SheetContent>
        </Sheet>

        {/* User menu */}
        <div
          data-testid={TEST_IDS.shop.headerUserMenu}
          className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-medium ${
            isDark ? "bg-gray-800 text-gray-300" : "bg-line-2 text-ink-muted"
          }`}
          title="Compte utilisateur"
          aria-label="Compte utilisateur"
        >
          U
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

      {/* ─── 3 colonnes grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_360px]">
        {/* Sidebar gauche desktop (gammes) — drawer mobile gere dans le header */}
        <aside
          data-testid={TEST_IDS.shop.navGammes}
          aria-label="Navigation des gammes"
          className={`hidden lg:block border-r ${
            isDark ? "border-gray-800 bg-gray-950" : "border-line bg-paper"
          }`}
        >
          {leftSidebar ?? (
            <DefaultGammesPlaceholder isDark={isDark} />
          )}
        </aside>

        {/* Main (children) */}
        <main className="min-h-[calc(100vh-64px)]">{children}</main>

        {/* Sidebar droite desktop (panier sticky) */}
        <aside
          data-testid={TEST_IDS.shop.cartSticky}
          aria-label="Panier"
          className={`hidden lg:block border-l ${
            isDark ? "border-gray-800 bg-gray-950" : "border-line bg-paper"
          }`}
        >
          <div className="sticky top-[64px] max-h-[calc(100vh-64px)] overflow-y-auto">
            {rightSidebar ?? (
              <DefaultCartPlaceholder isDark={isDark} cartCount={cartCount} onView={onView} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────── */
/* Placeholders MVP — remplaces par contenus reels via props leftSidebar /  */
/* rightSidebar dans PublicShop, ou par stories suivantes (S2.2, S2.6+).    */
/* ───────────────────────────────────────────────────────────────────────── */

function DefaultGammesPlaceholder({ isDark }: { isDark: boolean }) {
  return (
    <div className="p-5">
      <div
        className={`font-mono uppercase text-[10.5px] mb-3 ${
          isDark ? "text-gray-500" : "text-ink-mute-2"
        }`}
        style={{ letterSpacing: "0.08em", fontWeight: 500 }}
      >
        Gammes
      </div>
      <p
        className={`text-[13px] m-0 ${isDark ? "text-gray-500" : "text-ink-muted"}`}
        style={{ lineHeight: 1.55 }}
      >
        Navigation par gammes bientôt disponible.
      </p>
    </div>
  );
}

function DefaultCartPlaceholder({
  isDark,
  cartCount,
  onView,
}: {
  isDark: boolean;
  cartCount: number;
  onView: (v: PortalView) => void;
}) {
  return (
    <div className="p-5">
      <div
        className={`font-mono uppercase text-[10.5px] mb-3 ${
          isDark ? "text-gray-500" : "text-ink-mute-2"
        }`}
        style={{ letterSpacing: "0.08em", fontWeight: 500 }}
      >
        Panier
      </div>
      {cartCount === 0 ? (
        <p
          className={`text-[13px] m-0 ${isDark ? "text-gray-500" : "text-ink-muted"}`}
          style={{ lineHeight: 1.55 }}
        >
          Votre panier est vide. Ajoutez des produits depuis le catalogue.
        </p>
      ) : (
        <>
          <p
            className={`text-[13px] m-0 mb-3 ${isDark ? "text-gray-300" : "text-ink"}`}
          >
            {cartCount} article{cartCount > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={() => onView("cart")}
            className={`w-full text-[13px] px-3 py-2 rounded-md font-medium ${
              isDark
                ? "bg-gray-100 text-gray-950 hover:bg-white"
                : "bg-ink text-paper hover:bg-ink-2"
            }`}
          >
            Voir le panier
          </button>
        </>
      )}
    </div>
  );
}

