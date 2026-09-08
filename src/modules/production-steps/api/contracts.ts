/**
 * Contrats Zod du module Etapes de production (story E10.13).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas `ProductionStep`, `ProductionStepColor`, `ProductionStepStatusFilter`,
 * `CreateProductionStepCommand`, `UpdateProductionStepCommand`,
 * `ReorderProductionStepsCommand`). Le YAML fait foi ; ces schemas valident a
 * l execution ce que les types generes ne peuvent pas exprimer.
 *
 * `label` n est PAS normalise ici (pas de `.trim()` cote lecture) : le
 * contrat affiche le libelle TEL QUE SAISI. Seules les commandes d ecriture
 * trime en entree — la normalisation ne sert qu au controle d unicite EN
 * BASE (index unique fonctionnel `tenant_id, btrim(lower(label))`), jamais a
 * l affichage.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

/**
 * Palette FERMEE, memes valeurs que `ProjectTagColor` (E10.2) mais schema
 * NEANMOINS DISTINCT (contrat) : deux catalogues sans rapport, un type
 * partage rendrait un ajout futur impossible sans effet de bord.
 */
export const PRODUCTION_STEP_COLORS = ['slate', 'blue', 'green', 'amber', 'red', 'violet'] as const;

export const productionStepColorSchema = z.enum(PRODUCTION_STEP_COLORS);

export const productionStepStatusFilterSchema = z.enum(['active', 'disabled']);

export const productionStepSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    label: z.string().min(1).max(60),
    position: z.number().int().min(0),
    color: productionStepColorSchema,
    is_terminal: z.boolean(),
    is_active: z.boolean(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

export const productionStepsListSchema = z.array(productionStepSchema);

export const deleteProductionStepResultSchema = z.object({ deleted: z.literal(true) }).strict();

/**
 * Commande de creation (CA2). AUCUN champ `position` : la nouvelle etape est
 * ajoutee en FIN de flux, l ordre se change ensuite par `reorderProductionSteps`.
 */
export const createProductionStepCommandSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    color: productionStepColorSchema.optional(),
    is_terminal: z.boolean().optional().default(false),
  })
  .strict();

/**
 * Modification PARTIELLE (CA2, CA3, CA4). NI `position`, NI `tenant_id` :
 * l ordre se change par `reorderProductionSteps`, le tenant vient du jeton.
 */
export const updateProductionStepCommandSchema = z
  .object({
    label: z.string().trim().min(1).max(60).optional(),
    color: productionStepColorSchema.optional(),
    is_terminal: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

/**
 * `step_ids` porte la liste COMPLETE des etapes du tenant (actives ET
 * desactivees) dans l ordre voulu. Nomme d apres ce qu elle contient
 * (`line_ids`, `tag_ids`), jamais d apres ce qu on en fait.
 */
export const reorderProductionStepsCommandSchema = z
  .object({
    step_ids: z.array(uuidSchema).min(1).max(50),
  })
  .strict();

export type ProductionStepColor = z.infer<typeof productionStepColorSchema>;
export type ProductionStepStatusFilter = z.infer<typeof productionStepStatusFilterSchema>;
export type ProductionStepDto = z.infer<typeof productionStepSchema>;
export type DeleteProductionStepResultDto = z.infer<typeof deleteProductionStepResultSchema>;
export type CreateProductionStepCommand = z.infer<typeof createProductionStepCommandSchema>;
export type UpdateProductionStepCommand = z.infer<typeof updateProductionStepCommandSchema>;
export type ReorderProductionStepsCommand = z.infer<typeof reorderProductionStepsCommandSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que les
// autres modules E10.x, voir src/modules/_shared/api/contracts.ts).
// ---------------------------------------------------------------------------
import type {
  CreateProductionStepCommand as CreateProductionStepCommandContract,
  ProductionStep as ProductionStepContract,
  ProductionStepColor as ProductionStepColorContract,
  ProductionStepStatusFilter as ProductionStepStatusFilterContract,
  ReorderProductionStepsCommand as ReorderProductionStepsCommandContract,
  UpdateProductionStepCommand as UpdateProductionStepCommandContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const PRODUCTION_STEPS_CONTRACT_ALIGNMENT = Object.freeze({
  color: true as AssertAssignable<ProductionStepColor, ProductionStepColorContract>,
  statusFilter: true as AssertAssignable<ProductionStepStatusFilter, ProductionStepStatusFilterContract>,
  step: true as AssertAssignable<ProductionStepDto, ProductionStepContract>,
  createCommand: true as AssertAssignable<CreateProductionStepCommand, CreateProductionStepCommandContract>,
  updateCommand: true as AssertAssignable<UpdateProductionStepCommand, UpdateProductionStepCommandContract>,
  reorderCommand: true as AssertAssignable<ReorderProductionStepsCommand, ReorderProductionStepsCommandContract>,
});
