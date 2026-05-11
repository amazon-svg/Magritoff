/**
 * Schema zod pour valider un item de panier (R4 - refacto 2026-05-11).
 *
 * Pattern : un cart item canonique encapsule un produit (prix forfaitaire pour
 * une quantite d'ex) + un compteur de packs (defaut 1). La distinction
 * `cart.qty=1 pack` vs `product.config.quantity=500 ex` est cruciale —
 * S-FIX-PANIER-11/05 a corrige le bug ou multiplier price * qty d'ex faisait
 * exploser le total (35 € × 500 = 17500 €).
 */

import { z } from 'zod';

/** Forme minimale du `product` embarque dans un cart item. */
export const cartProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price_ht: z.number().nonnegative().optional(),
  /** Champ legacy : price = prix forfaitaire pack. Conserve pour retro-compat. */
  price: z.number().nonnegative().optional(),
  config: z.unknown().optional(),
  client_id: z.string().nullable().optional(),
});

export const cartItemSchema = z.object({
  id: z.string().min(1),
  product: cartProductSchema,
  /** Nombre de packs (defaut 1). NE PAS confondre avec config.quantity (= nb d'ex). */
  qty: z.number().int().positive().default(1),
  addedAt: z.string().optional(),
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type CartProduct = z.infer<typeof cartProductSchema>;
