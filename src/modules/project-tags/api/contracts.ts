/**
 * Contrats Zod du module Tags de projet (story E10.2).
 *
 * Miroir d execution du contrat decrit dans openapi/magrit-core.v1.yaml
 * (schemas ProjectTag, ProjectTagColor, CreateProjectTagCommand). Le YAML
 * fait foi ; ces schemas valident a l execution ce que les types generes ne
 * peuvent pas exprimer.
 *
 * `label` n est PAS normalise ici (pas de `.trim()` cote lecture) : le
 * contrat impose d afficher le libelle TEL QUE SAISI (CA1). Seule la
 * commande de creation trime en entree (CA2) — la normalisation ne sert
 * qu au controle d unicite, jamais a l affichage.
 */
import { z } from 'zod';
import { timestampSchema, uuidSchema } from '../../_shared/api/index.ts';

/**
 * Palette FERMEE de jetons de couleur (CA1), alignee sur les tokens
 * shadcn/Tailwind du design system. Jamais un code hexadecimal : la charte
 * peut evoluer sans migration.
 */
export const PROJECT_TAG_COLORS = ['slate', 'blue', 'green', 'amber', 'red', 'violet'] as const;

export const projectTagColorSchema = z.enum(PROJECT_TAG_COLORS);

export const projectTagSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    label: z.string().min(1).max(60),
    color: projectTagColorSchema,
    created_at: timestampSchema,
  })
  .strict();

export const projectTagsListSchema = z.array(projectTagSchema);

/**
 * Commande de creation a la volee (CA2). La couleur n est PAS choisie par
 * l appelant : le service l assigne depuis la palette fermee, de facon
 * deterministe pour un meme libelle normalise (voir
 * `application/project-tags-service.ts`, `colorForLabel`).
 */
export const createProjectTagCommandSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
  })
  .strict();

export const deleteProjectTagResultSchema = z.object({ deleted: z.literal(true) }).strict();

export type ProjectTagColor = z.infer<typeof projectTagColorSchema>;
export type ProjectTagDto = z.infer<typeof projectTagSchema>;
export type CreateProjectTagCommand = z.infer<typeof createProjectTagCommandSchema>;
export type DeleteProjectTagResultDto = z.infer<typeof deleteProjectTagResultSchema>;

// ---------------------------------------------------------------------------
// Alignement de compilation contrat <-> schemas (meme garde-fou que E10.1,
// voir src/modules/_shared/api/contracts.ts pour la portee exacte).
// ---------------------------------------------------------------------------
import type {
  ProjectTag as ProjectTagContract,
  ProjectTagColor as ProjectTagColorContract,
} from '../../../platform/api/generated/magrit-core.v1.ts';

type AssertAssignable<TSource, TTarget> = TSource extends TTarget ? true : never;

export const PROJECT_TAGS_CONTRACT_ALIGNMENT = Object.freeze({
  projectTagColor: true as AssertAssignable<ProjectTagColor, ProjectTagColorContract>,
  projectTagId: true as AssertAssignable<ProjectTagDto['id'], ProjectTagContract['id']>,
  projectTagLabel: true as AssertAssignable<ProjectTagDto['label'], ProjectTagContract['label']>,
});
