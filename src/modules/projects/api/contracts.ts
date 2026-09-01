/**
 * Contrats Zod du module Projets (story E10.1).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas Project, ProjectItem, ProjectDetail, ...). Comme pour le socle
 * E10.0, le YAML fait foi ; ces schemas valident a l execution ce que les
 * types generes ne peuvent pas exprimer.
 *
 * `customer_id` n est PAS un champ requis au sens Zod ici (contrairement au
 * contrat, ou `CreateProjectCommand.customer_id` est `required`) : le CA3
 * ("absent ou inconnu du tenant" -> 422 `project.customer_required`) exige
 * que les DEUX cas produisent EXACTEMENT le meme code metier. Rendre le
 * champ requis au niveau du schema ferait passer le cas "absent" par
 * `api.validation_failed` (erreur de forme), un code different du cas
 * "inconnu" (erreur metier, verifiee par le service apres lookup du
 * client). Le controle unique vit donc dans
 * `src/modules/projects/application/projects-service.ts`.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

export const projectStatusSchema = z.enum(['active', 'archived']);

export const projectSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    name: z.string().min(1).max(300),
    status: projectStatusSchema,
    /** Point d extension E10.2 (tags de projet). Toujours vide pour l instant. */
    tags: z.array(z.unknown()),
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
  })
  .strict();

export const projectItemSchema = z
  .object({
    id: uuidSchema,
    project_id: uuidSchema,
    label: z.string().min(1).max(300),
    quote_payload: z.record(z.string(), z.unknown()),
    clariprint_config: z.record(z.string(), z.unknown()).nullable(),
    position: z.number().int().min(0),
    created_at: timestampSchema,
  })
  .strict();

/**
 * Projet detaille avec ses elements de chiffrage (CA5). Point d extension
 * E10.2 (`tags`) toujours vide, meme principe que `CustomerDetail`.
 */
export const projectDetailSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    customer_id: uuidSchema,
    name: z.string().min(1).max(300),
    status: projectStatusSchema,
    tags: z.array(z.unknown()),
    created_by: uuidSchema.nullable(),
    created_at: timestampSchema,
    updated_at: timestampSchema,
    items: z.array(projectItemSchema),
  })
  .strict();

/**
 * Commande de creation. `customer_id` est une chaine simple ici (voir note
 * de tete de fichier) : le format UUID et l existence dans le tenant sont
 * verifies par le service, pas par ce schema.
 */
export const createProjectCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    customer_id: z.string().trim().optional(),
  })
  .strict();

export const updateProjectCommandSchema = z
  .object({
    name: z.string().trim().min(1).max(300).optional(),
    customer_id: z.string().trim().optional(),
    status: projectStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'La modification doit porter au moins un champ.',
  });

export const createProjectItemCommandSchema = z
  .object({
    label: z.string().trim().min(1).max(300),
    quote_payload: z.record(z.string(), z.unknown()),
    clariprint_config: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

export const removeProjectItemResultSchema = z.object({ removed: z.literal(true) }).strict();

export const projectsListSchema = z.array(projectSchema);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectDto = z.infer<typeof projectSchema>;
export type ProjectItemDto = z.infer<typeof projectItemSchema>;
export type ProjectDetailDto = z.infer<typeof projectDetailSchema>;
export type CreateProjectCommand = z.infer<typeof createProjectCommandSchema>;
export type UpdateProjectCommand = z.infer<typeof updateProjectCommandSchema>;
export type CreateProjectItemCommand = z.infer<typeof createProjectItemCommandSchema>;
export type RemoveProjectItemResultDto = z.infer<typeof removeProjectItemResultSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que E10.4,
// voir src/modules/_shared/api/contracts.ts pour la portee exacte).
// ---------------------------------------------------------------------------
import type {
  Project as ProjectContract,
  ProjectItem as ProjectItemContract,
  ProjectStatus as ProjectStatusContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const PROJECTS_CONTRACT_ALIGNMENT = Object.freeze({
  projectStatus: true as AssertAssignable<ProjectStatus, ProjectStatusContract>,
  projectId: true as AssertAssignable<ProjectDto['id'], ProjectContract['id']>,
  projectCustomerId: true as AssertAssignable<
    ProjectDto['customer_id'],
    ProjectContract['customer_id']
  >,
  projectItemPosition: true as AssertAssignable<
    ProjectItemDto['position'],
    ProjectItemContract['position']
  >,
});
