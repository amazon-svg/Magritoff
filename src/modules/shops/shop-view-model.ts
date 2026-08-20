import type { ShopCustomMockup } from './api/contracts.ts';

/** Modèle de lecture compatible avec l’UI historique pendant la migration API-first. */
export interface ShopTheme {
  primaryColor: string;
  accentColor: string;
  mode: 'light' | 'dark';
  secondaryColor?: string;
  textColor?: string;
  bgColor?: string;
  fontPairing?: string;
}

export interface Shop {
  id: string;
  owner_user_id?: string;
  slug: string;
  name: string;
  description: string;
  theme: ShopTheme;
  logo_url: string;
  address: string;
  contact_email: string;
  active: boolean;
  library_ids: string[];
  excluded_product_ids: string[];
  hero_image_url: string | null;
  tagline: string | null;
  pim_catalog_mode: boolean;
  pim_gamme_slugs: string[];
  tenant_id?: string | null;
  access_mode?: 'invite_only' | 'self_signup';
  created_at?: string;
  custom_mockups?: ShopCustomMockup[];
}

export interface ShopProduct {
  id: string;
  shop_id: string;
  product_id: string | null;
  name: string;
  category: string;
  description: string;
  price_ht: number;
  image_url: string;
  config: Record<string, unknown>;
  display_order: number;
  created_at?: string;
  tenant_id?: string | null;
  gamme_slug?: string | null;
}
