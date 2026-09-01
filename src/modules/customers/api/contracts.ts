/**
 * Contrats Zod du module Clients (story E10.4).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas Customer, CustomerContact, CustomerDetail, ...). Comme pour le
 * socle E10.0, le YAML fait foi ; ces schemas valident a l execution ce que
 * les types generes ne peuvent pas exprimer (pattern, min/max, regles
 * conditionnelles selon `type`).
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';
import { checkSiretFormat } from '../application/siret-verification.ts';

export const customerTypeSchema = z.enum(['company', 'individual']);

export const addressSchema = z
  .object({
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().min(1).max(200).nullable().optional(),
    postal_code: z.string().trim().min(1).max(20),
    city: z.string().trim().min(1).max(120),
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'Code pays ISO 3166-1 alpha-2 (ex. "FR").'),
  })
  .strict();

export const siretSchema = z.string().regex(/^[0-9]{14}$/, {
  message: 'Un SIRET comporte 14 chiffres.',
});

export const customerSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    type: customerTypeSchema,
    company_name: z.string().nullable(),
    siret: siretSchema.nullable(),
    vat_number: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    billing_address: addressSchema.nullable(),
    shipping_address: addressSchema.nullable(),
    is_active: z.boolean(),
    siret_verified: z.boolean(),
    siret_verified_at: timestampSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

export const customerContactSchema = z
  .object({
    id: uuidSchema,
    customer_id: uuidSchema,
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    role: z.string().nullable(),
    email: z.string().email(),
    phone: z.string().nullable(),
    is_primary: z.boolean(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

/**
 * Fiche client complete. `projects`/`quotes`/`orders` sont des points
 * d extension : toujours vides tant que E10.1/E10.3/E10.12 ne sont pas
 * livrees (pas de donnee inventee).
 */
export const customerDetailSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    type: customerTypeSchema,
    company_name: z.string().nullable(),
    siret: siretSchema.nullable(),
    vat_number: z.string().nullable(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    billing_address: addressSchema.nullable(),
    shipping_address: addressSchema.nullable(),
    is_active: z.boolean(),
    siret_verified: z.boolean(),
    siret_verified_at: timestampSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
    contacts: z.array(customerContactSchema),
    projects: z.array(z.unknown()),
    quotes: z.array(z.unknown()),
    orders: z.array(z.unknown()),
  })
  .strict();

const baseCreateCustomerFields = {
  company_name: z.string().trim().min(1).max(300).nullable().optional(),
  siret: z.string().trim().nullable().optional(),
  vat_number: z.string().trim().min(1).max(32).nullable().optional(),
  first_name: z.string().trim().min(1).max(120).nullable().optional(),
  last_name: z.string().trim().min(1).max(120).nullable().optional(),
  billing_address: addressSchema.nullable().optional(),
  shipping_address: addressSchema.nullable().optional(),
};

/**
 * Commande de creation. La forme du schema n exige que `type` : les champs
 * requis selon `type` (CA2) sont verifies par `superRefine`, pour produire des
 * erreurs de champ nommees (`company_name`, `siret`, `first_name`,
 * `last_name`) plutot qu un rejet de forme generique.
 */
export const createCustomerCommandSchema = z
  .object({ type: customerTypeSchema, ...baseCreateCustomerFields })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'company') {
      if (!value.company_name) {
        ctx.addIssue({
          code: 'custom',
          path: ['company_name'],
          message: 'La raison sociale est requise pour un client entreprise.',
        });
      }
      if (!value.siret) {
        ctx.addIssue({
          code: 'custom',
          path: ['siret'],
          message: 'Le SIRET est requis pour un client entreprise.',
        });
      } else {
        const check = checkSiretFormat(value.siret);
        if (!check.ok) {
          ctx.addIssue({
            code: 'custom',
            path: ['siret'],
            message:
              check.error === 'siret_shape'
                ? 'Le SIRET doit comporter 14 chiffres.'
                : 'SIRET invalide (echec de la cle de Luhn).',
          });
        }
      }
    } else {
      if (!value.first_name) {
        ctx.addIssue({
          code: 'custom',
          path: ['first_name'],
          message: 'Le prenom est requis pour un client particulier.',
        });
      }
      if (!value.last_name) {
        ctx.addIssue({
          code: 'custom',
          path: ['last_name'],
          message: 'Le nom est requis pour un client particulier.',
        });
      }
    }
  });

export const updateCustomerCommandSchema = z
  .object(baseCreateCustomerFields)
  .extend({ is_active: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export const createCustomerContactCommandSchema = z
  .object({
    first_name: z.string().trim().min(1).max(120),
    last_name: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(120).nullable().optional(),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().min(1).max(40).nullable().optional(),
    is_primary: z.boolean().optional().default(false),
  })
  .strict();

export const updateCustomerContactCommandSchema = z
  .object({
    first_name: z.string().trim().min(1).max(120).optional(),
    last_name: z.string().trim().min(1).max(120).optional(),
    role: z.string().trim().min(1).max(120).nullable().optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().min(1).max(40).nullable().optional(),
    is_primary: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export const siretVerificationResultSchema = z
  .object({
    siret: siretSchema,
    verified: z.boolean(),
    company_name: z.string().nullable(),
    naf_code: z.string().nullable(),
    active: z.boolean(),
    mocked: z.boolean(),
    checked_at: timestampSchema,
  })
  .strict();

export const customersListSchema = z.array(customerSchema);

export type CustomerType = z.infer<typeof customerTypeSchema>;
export type Address = z.infer<typeof addressSchema>;
export type CustomerDto = z.infer<typeof customerSchema>;
export type CustomerContactDto = z.infer<typeof customerContactSchema>;
export type CustomerDetailDto = z.infer<typeof customerDetailSchema>;
export type CreateCustomerCommand = z.infer<typeof createCustomerCommandSchema>;
export type UpdateCustomerCommand = z.infer<typeof updateCustomerCommandSchema>;
export type CreateCustomerContactCommand = z.infer<typeof createCustomerContactCommandSchema>;
export type UpdateCustomerContactCommand = z.infer<typeof updateCustomerContactCommandSchema>;
export type SiretVerificationResultDto = z.infer<typeof siretVerificationResultSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que E10.0,
// voir src/modules/_shared/api/contracts.ts pour la portee exacte : il mord
// sur un champ disparu ou une enumeration, pas sur un `pattern`).
// ---------------------------------------------------------------------------
import type {
  Customer as CustomerContract,
  CustomerContact as CustomerContactContract,
  CustomerType as CustomerTypeContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const CUSTOMERS_CONTRACT_ALIGNMENT = Object.freeze({
  customerType: true as AssertAssignable<CustomerType, CustomerTypeContract>,
  customerId: true as AssertAssignable<CustomerDto['id'], CustomerContract['id']>,
  customerIsActive: true as AssertAssignable<
    CustomerDto['is_active'],
    CustomerContract['is_active']
  >,
  contactIsPrimary: true as AssertAssignable<
    CustomerContactDto['is_primary'],
    CustomerContactContract['is_primary']
  >,
});
