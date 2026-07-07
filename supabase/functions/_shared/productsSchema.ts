/**
 * productsSchema — Zod schema partage pour la reponse JSON Claude de claude-proxy.
 *
 * Story S1.5 (Epic 1, suite S1.3, 2026-05-10).
 *
 * Schema permissif (`.passthrough()`) pour absorber les variations Claude :
 * certains champs (description, deliveryInfo, addressProvided, pages, dimensions.unit)
 * sont parfois absents selon le type de demande (calcul prix vs catalogue vs question pedagogique).
 *
 * Le shape canonique est documente dans claude-proxy/index.ts (systemPrompt).
 *
 * Decision (cf. story-S1.5 Dev Notes) : permissif au debut pour eviter les rejets
 * sur des reponses Claude legitimes ; durcissement possible en S+1 quand stable.
 */

import { z } from "npm:zod@3";

const DimensionsSchema = z
  .object({
    width: z.number(),
    height: z.number(),
    unit: z.string().optional(),
  })
  .passthrough();

const PrintingSchema = z
  .object({
    recto: z.string(),
    verso: z.string(),
  })
  .passthrough();

export const ProductSchema = z
  .object({
    productName: z.string(),
    name: z.string().optional(),
    // ADR-4.17 (2026-07-07) : gamme/famille explicite du produit (slug racine).
    // Autoritaire cote app (product.gamme_slug). Optionnel au schema (passthrough)
    // pour ne pas rejeter, mais explicitement demande dans le system prompt.
    gamme: z.string().optional(),
    quantity: z.number(),
    dimensions: DimensionsSchema,
    material: z.string(),
    weight: z.number(),
    printing: PrintingSchema,
    finishRecto: z.string().optional(),
    finishVerso: z.string().optional(),
    finish: z.string().optional(),
    packaging: z.string().optional(),
    deliveryLocation: z.string().optional(),
    addressProvided: z.string().optional(),
    pages: z.number().optional(),
    suggestions: z.array(z.string()).optional(),
    description: z.string().optional(),
    deliveryInfo: z.string().optional(),
  })
  .passthrough();

export const ProductsResponseSchema = z
  .object({
    teachingNote: z.string().optional(),
    products: z.array(ProductSchema).min(1),
  })
  .passthrough();

export type Product = z.infer<typeof ProductSchema>;
export type ProductsResponse = z.infer<typeof ProductsResponseSchema>;
