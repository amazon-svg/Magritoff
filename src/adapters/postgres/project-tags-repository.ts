import type { TenantId } from '../../kernel/ids/index.ts';
import type {
  CreateProjectTagCommand,
  ProjectTagColor,
  ProjectTagDto,
} from '../../modules/project-tags/api/contracts.ts';
import {
  ProjectTagCommandRejectedError,
  ProjectTagNotFoundError,
  type CreateProjectTagResult,
  type ListProjectTagsParams,
  type ProjectTagsRepository,
} from '../../modules/project-tags/application/project-tags-repository.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type ProjectTagRow = Readonly<{
  id: string;
  tenant_id: string;
  label: string;
  color: ProjectTagColor;
  created_at: Date;
}>;

export class PostgresProjectTagsRepository implements ProjectTagsRepository {
  constructor(private readonly transactions: PostgresTransactionRunner) {}

  list(tenantId: TenantId, params: ListProjectTagsParams): Promise<readonly ProjectTagDto[]> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [tenantId];
      let filter = '';
      const q = sanitizeSearchTerm(params.q ?? '');
      if (q.length > 0) {
        values.push(`%${q}%`);
        filter = `
          and regexp_replace(
            regexp_replace(label, '[,()]', ' ', 'g'),
            '[[:space:]]+', ' ', 'g'
          ) ilike $2
        `;
      }
      const result = await client.query<ProjectTagRow>(`
        select * from public.project_tags
         where tenant_id = $1${filter}
         order by label asc, id asc
      `, values);
      return result.rows.map(toProjectTagDto);
    });
  }

  findById(tenantId: TenantId, tagId: string): Promise<ProjectTagDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<ProjectTagRow>(
        'select * from public.project_tags where tenant_id = $1 and id = $2',
        [tenantId, tagId],
      );
      return result.rows[0] === undefined ? null : toProjectTagDto(result.rows[0]);
    });
  }

  findManyByIds(
    tenantId: TenantId,
    tagIds: readonly string[],
  ): Promise<readonly ProjectTagDto[]> {
    if (tagIds.length === 0) return Promise.resolve([]);
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<ProjectTagRow>(`
        select * from public.project_tags
         where tenant_id = $1 and id = any($2::uuid[])
         order by label asc, id asc
      `, [tenantId, [...tagIds]]);
      return result.rows.map(toProjectTagDto);
    });
  }

  createOrGet(
    tenantId: TenantId,
    command: CreateProjectTagCommand & Readonly<{ color: ProjectTagColor }>,
  ): Promise<CreateProjectTagResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      try {
        const inserted = await client.query<ProjectTagRow>(`
          insert into public.project_tags (tenant_id, label, color)
          values ($1, $2, $3)
          on conflict (tenant_id, (btrim(lower(label)))) do nothing
          returning *
        `, [tenantId, command.label, command.color]);
        const created = inserted.rows[0];
        if (created !== undefined) return { tag: toProjectTagDto(created), created: true };

        const existing = await client.query<ProjectTagRow>(`
          select * from public.project_tags
           where tenant_id = $1 and btrim(lower(label)) = btrim(lower($2))
        `, [tenantId, command.label]);
        if (existing.rows[0] === undefined) {
          throw new Error('Tag concurrent introuvable apres le conflit d unicite.');
        }
        return { tag: toProjectTagDto(existing.rows[0]), created: false };
      } catch (error) {
        throw mapError(error, 'Création du tag impossible.');
      }
    });
  }

  delete(tenantId: TenantId, tagId: string): Promise<void> {
    return this.transactions.run({ tenantId }, async (client) => {
      try {
        const result = await client.query(
          'delete from public.project_tags where tenant_id = $1 and id = $2',
          [tenantId, tagId],
        );
        if (result.rowCount !== 1) throw new ProjectTagNotFoundError();
      } catch (error) {
        throw mapError(error, 'Suppression du tag impossible.');
      }
    });
  }
}

function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toProjectTagDto(row: ProjectTagRow): ProjectTagDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    label: row.label,
    color: row.color,
    created_at: toIsoTimestamp(row.created_at),
  };
}

function mapError(error: unknown, fallback: string): Error {
  if (error instanceof ProjectTagNotFoundError) return error;
  const value = error as { code?: string; message?: string };
  if (value.code === '23503') {
    return new ProjectTagCommandRejectedError(
      'project_tag.in_use',
      'Ce tag est encore utilisé par au moins un projet.',
      [{ field: 'id', message: 'Tag encore utilisé par au moins un projet.' }],
    );
  }
  if (value.code === '23514') {
    return new ProjectTagCommandRejectedError(
      'api.validation_failed',
      value.message ?? fallback,
    );
  }
  return error instanceof Error ? error : new Error(fallback);
}
