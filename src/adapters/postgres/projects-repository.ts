import type { PoolClient } from 'pg';
import type { TenantId, UserId } from '../../kernel/ids/index.ts';
import { toIsoTimestamp } from '../../modules/_shared/application/index.ts';
import type { ProjectTagDto } from '../../modules/project-tags/api/contracts.ts';
import type {
  CreateProjectCommand,
  CreateProjectItemCommand,
  ImportedCommercialFile,
  ProjectDetailDto,
  ProjectDto,
  ProjectItemDto,
  UpdateProjectCommand,
  UpdateProjectItemCommand,
} from '../../modules/projects/api/contracts.ts';
import {
  ProjectCommandRejectedError,
  ProjectNotFoundError,
  type ListProjectsParams,
  type ListProjectsResult,
  type ProjectCommercialFileStorage,
  type ProjectsRepository,
} from '../../modules/projects/application/projects-repository.ts';
import type { PostgresTransactionRunner } from './transaction-runner.ts';

type ProjectRow = Readonly<{
  id: string;
  tenant_id: string;
  customer_id: string;
  name: string;
  status: ProjectDto['status'];
  hopstudio_session_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  tags: unknown;
}>;

type ProjectItemRow = Readonly<{
  id: string;
  project_id: string;
  label: string;
  description_html: string | null;
  quote_payload: Record<string, unknown>;
  clariprint_config: Record<string, unknown> | null;
  position: number;
  created_at: Date;
}>;

const PROJECT_COLUMNS = `
  project.*,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', tag.id,
      'tenant_id', tag.tenant_id,
      'label', tag.label,
      'color', tag.color,
      'created_at', tag.created_at
    ) order by tag.id)
      from public.project_tag_links link
      join public.project_tags tag on tag.id = link.tag_id and tag.tenant_id = link.tenant_id
     where link.project_id = project.id and link.tenant_id = project.tenant_id
  ), '[]'::jsonb) as tags
`;

export class PostgresProjectsRepository implements ProjectsRepository {
  constructor(
    private readonly transactions: PostgresTransactionRunner,
    private readonly storage: ProjectCommercialFileStorage,
  ) {}

  list(tenantId: TenantId, params: ListProjectsParams): Promise<ListProjectsResult> {
    return this.transactions.run({ tenantId }, async (client) => {
      const values: unknown[] = [tenantId, params.size + 1];
      const filters = ['project.tenant_id = $1'];
      if (params.customerId !== null) {
        values.push(params.customerId);
        filters.push(`project.customer_id = $${values.length}`);
      }
      if (params.status !== null) {
        values.push(params.status);
        filters.push(`project.status = $${values.length}`);
      }
      const q = sanitizeSearchTerm(params.q ?? '');
      if (q.length > 0) {
        values.push(`%${q}%`);
        const placeholder = `$${values.length}`;
        filters.push(`(
          ${searchExpression('project.name')} ilike ${placeholder}
          or exists (
            select 1 from public.customers customer
             where customer.id = project.customer_id and customer.tenant_id = project.tenant_id
               and ${searchExpression("concat_ws(' ', customer.company_name, customer.first_name, customer.last_name)")} ilike ${placeholder}
          )
        )`);
      }
      if (params.tagIds.length > 0) {
        values.push([...params.tagIds], params.tagIds.length);
        filters.push(`(
          select count(distinct link.tag_id) from public.project_tag_links link
           where link.project_id = project.id and link.tenant_id = project.tenant_id
             and link.tag_id = any($${values.length - 1}::uuid[])
        ) = $${values.length}`);
      }
      if (params.cursor !== null) {
        values.push(params.cursor.sort, params.cursor.id);
        filters.push(`(project.updated_at, project.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
      }
      const result = await client.query<ProjectRow>(`
        select ${PROJECT_COLUMNS}
          from public.projects project
         where ${filters.join(' and ')}
         order by project.updated_at desc, project.id desc
         limit $2
      `, values);
      return { rows: result.rows.map(toProjectDto) };
    });
  }

  findById(tenantId: TenantId, projectId: string): Promise<ProjectDto | null> {
    return this.transactions.run({ tenantId }, async (client) => (
      this.selectProject(client, tenantId, projectId)
    ));
  }

  async findDetailById(tenantId: TenantId, projectId: string): Promise<ProjectDetailDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const project = await this.selectProject(client, tenantId, projectId);
      if (project === null) return null;
      const items = await client.query<ProjectItemRow>(`
        select * from public.project_items
         where tenant_id = $1 and project_id = $2
         order by position asc, id asc
      `, [tenantId, projectId]);
      return { ...project, items: items.rows.map(toProjectItemDto) };
    });
  }

  findItemById(
    tenantId: TenantId,
    projectId: string,
    itemId: string,
  ): Promise<ProjectItemDto | null> {
    return this.transactions.run({ tenantId }, async (client) => {
      const result = await client.query<ProjectItemRow>(`
        select * from public.project_items
         where tenant_id = $1 and project_id = $2 and id = $3
      `, [tenantId, projectId, itemId]);
      return result.rows[0] === undefined ? null : toProjectItemDto(result.rows[0]);
    });
  }

  create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateProjectCommand & Readonly<{ customer_id: string }>,
  ): Promise<ProjectDto> {
    return this.write(tenantId, async (client) => {
      const inserted = await client.query<{ id: string }>(`
        insert into public.projects (tenant_id, customer_id, name, created_by)
        values ($1, $2, $3, $4) returning id
      `, [tenantId, command.customer_id, command.name, actor]);
      return requiredProject(await this.selectProject(client, tenantId, inserted.rows[0]!.id));
    }, actor);
  }

  update(tenantId: TenantId, projectId: string, command: UpdateProjectCommand): Promise<ProjectDto> {
    return this.write(tenantId, async (client) => {
      const { assignments, values } = patch(command, [
        'name', 'customer_id', 'status', 'hopstudio_session_id',
      ]);
      if (assignments.length > 0) {
        const result = await client.query(
          `update public.projects set ${assignments.join(', ')} where tenant_id = $1 and id = $2`,
          [tenantId, projectId, ...values],
        );
        if (result.rowCount !== 1) throw new ProjectNotFoundError();
      }
      return requiredProject(await this.selectProject(client, tenantId, projectId));
    });
  }

  async addItem(
    tenantId: TenantId,
    projectId: string,
    command: CreateProjectItemCommand & Readonly<{ files?: readonly ImportedCommercialFile[] }>,
  ): Promise<ProjectItemDto> {
    const itemId = crypto.randomUUID();
    const prepared = (command.files ?? []).map((file) => ({
      file,
      fileId: crypto.randomUUID(),
      bytes: decodeBase64(file.data_base64),
    }));
    for (const entry of prepared) {
      if (entry.bytes.byteLength === 0 || entry.bytes.byteLength > 15_000_000) {
        throw new ProjectCommandRejectedError(
          'project.file_invalid',
          'Le fichier commercial doit peser entre 1 octet et 15 Mo.',
        );
      }
    }

    const uploaded: string[] = [];
    try {
      for (const entry of prepared) {
        const result = await this.storage.upload({
          tenantId,
          fileId: entry.fileId,
          bytes: entry.bytes,
          contentType: entry.file.content_type,
        });
        uploaded.push(result.storagePath);
      }
      return await this.write(tenantId, async (client) => {
        await client.query(
          `select pg_advisory_xact_lock(hashtextextended('project_items:' || $1::text, 0))`,
          [projectId],
        );
        await this.assertProject(client, tenantId, projectId);
        const inserted = await client.query<ProjectItemRow>(`
          insert into public.project_items (
            id, tenant_id, project_id, label, description_html,
            quote_payload, clariprint_config, position
          ) values (
            $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb,
            (select count(*) from public.project_items where project_id = $3)
          ) returning *
        `, [
          itemId,
          tenantId,
          projectId,
          command.label,
          command.description_html ?? null,
          JSON.stringify(command.quote_payload),
          command.clariprint_config == null ? null : JSON.stringify(command.clariprint_config),
        ]);
        for (let index = 0; index < prepared.length; index += 1) {
          const entry = prepared[index]!;
          await client.query(`
            insert into public.commercial_files (
              id, tenant_id, kind, visibility, filename, content_type, byte_size, storage_path
            ) values ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            entry.fileId, tenantId, entry.file.kind, entry.file.visibility,
            entry.file.filename, entry.file.content_type, entry.bytes.byteLength, uploaded[index],
          ]);
          await client.query(`
            insert into public.project_item_files (tenant_id, project_item_id, file_id)
            values ($1, $2, $3)
          `, [tenantId, itemId, entry.fileId]);
        }
        return toProjectItemDto(inserted.rows[0]!);
      });
    } catch (error) {
      await Promise.allSettled(uploaded.map((path) => this.storage.remove(path)));
      throw error;
    }
  }

  updateItem(
    tenantId: TenantId,
    projectId: string,
    itemId: string,
    command: UpdateProjectItemCommand,
  ): Promise<ProjectItemDto> {
    return this.write(tenantId, async (client) => {
      const result = await client.query<ProjectItemRow>(`
        update public.project_items set label = $4
         where tenant_id = $1 and project_id = $2 and id = $3 returning *
      `, [tenantId, projectId, itemId, command.label]);
      if (result.rows[0] === undefined) {
        throw new ProjectNotFoundError('Élément de projet introuvable dans ce tenant.');
      }
      return toProjectItemDto(result.rows[0]);
    });
  }

  removeItem(tenantId: TenantId, projectId: string, itemId: string): Promise<void> {
    return this.write(tenantId, async (client) => {
      const result = await client.query(`
        delete from public.project_items
         where tenant_id = $1 and project_id = $2 and id = $3
      `, [tenantId, projectId, itemId]);
      if (result.rowCount !== 1) {
        throw new ProjectNotFoundError('Élément de projet introuvable dans ce tenant.');
      }
    });
  }

  replaceTags(tenantId: TenantId, projectId: string, tagIds: readonly string[]): Promise<ProjectDto> {
    return this.write(tenantId, async (client) => {
      await this.assertProject(client, tenantId, projectId);
      await client.query(
        'delete from public.project_tag_links where tenant_id = $1 and project_id = $2',
        [tenantId, projectId],
      );
      if (tagIds.length > 0) {
        await client.query(`
          insert into public.project_tag_links (tenant_id, project_id, tag_id)
          select $1, $2, tag_id from unnest($3::uuid[]) tag_id
        `, [tenantId, projectId, [...tagIds]]);
      }
      await client.query(
        'update public.projects set updated_at = clock_timestamp() where tenant_id = $1 and id = $2',
        [tenantId, projectId],
      );
      return requiredProject(await this.selectProject(client, tenantId, projectId));
    });
  }

  private async selectProject(
    client: PoolClient,
    tenantId: TenantId,
    projectId: string,
  ): Promise<ProjectDto | null> {
    const result = await client.query<ProjectRow>(`
      select ${PROJECT_COLUMNS} from public.projects project
       where project.tenant_id = $1 and project.id = $2
    `, [tenantId, projectId]);
    return result.rows[0] === undefined ? null : toProjectDto(result.rows[0]);
  }

  private async assertProject(client: PoolClient, tenantId: TenantId, projectId: string): Promise<void> {
    const result = await client.query(
      'select 1 from public.projects where tenant_id = $1 and id = $2',
      [tenantId, projectId],
    );
    if (result.rowCount !== 1) throw new ProjectNotFoundError();
  }

  private async write<T>(
    tenantId: TenantId,
    operation: (client: PoolClient) => Promise<T>,
    actor?: UserId,
  ): Promise<T> {
    try {
      return await this.transactions.run(
        { tenantId, ...(actor === undefined ? {} : { userId: actor }) },
        operation,
      );
    } catch (error) {
      throw mapError(error);
    }
  }
}

function searchExpression(expression: string): string {
  return `regexp_replace(regexp_replace(${expression}, '[,()]', ' ', 'g'), '[[:space:]]+', ' ', 'g')`;
}

function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function patch(command: Record<string, unknown>, allowed: readonly string[]) {
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const field of allowed) {
    if (field in command) {
      values.push(command[field]);
      assignments.push(`${field} = $${values.length + 2}`);
    }
  }
  return { assignments, values };
}

function toProjectDto(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    name: row.name,
    status: row.status,
    hopstudio_session_id: row.hopstudio_session_id,
    tags: Array.isArray(row.tags) ? row.tags.map(toProjectTagDto) : [],
    created_by: row.created_by,
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at),
  };
}

function toProjectTagDto(value: unknown): ProjectTagDto {
  const row = value as Record<string, unknown>;
  return {
    id: String(row['id']),
    tenant_id: String(row['tenant_id']),
    label: String(row['label']),
    color: row['color'] as ProjectTagDto['color'],
    created_at: toIsoTimestamp(row['created_at'] as string),
  };
}

function toProjectItemDto(row: ProjectItemRow): ProjectItemDto {
  return {
    id: row.id,
    project_id: row.project_id,
    label: row.label,
    description_html: row.description_html,
    quote_payload: row.quote_payload,
    clariprint_config: row.clariprint_config,
    position: Number(row.position),
    created_at: toIsoTimestamp(row.created_at),
  };
}

function requiredProject(project: ProjectDto | null): ProjectDto {
  if (project === null) throw new ProjectNotFoundError();
  return project;
}

function decodeBase64(value: string): Uint8Array {
  const payload = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  try {
    const binary = atob(payload);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new ProjectCommandRejectedError(
      'project.file_invalid',
      'Le contenu du fichier commercial n’est pas un base64 valide.',
    );
  }
}

function mapError(error: unknown): Error {
  if (error instanceof ProjectNotFoundError || error instanceof ProjectCommandRejectedError) {
    return error;
  }
  const value = error as { code?: string; constraint?: string; message?: string };
  if (value.code === '23505' && value.constraint === 'projects_tenant_hopstudio_session_id_unique') {
    return new ProjectCommandRejectedError(
      'project.hopstudio_session_already_assigned',
      'Cette session HopeStudio est déjà associée à un autre projet.',
      [{ field: 'hopstudio_session_id', message: 'Une session HopeStudio ne peut appartenir qu’à un seul projet.' }],
    );
  }
  if (value.code === '23502' || value.code === '23503') {
    return new ProjectCommandRejectedError(
      'project.customer_required',
      'Un projet exige un client existant du tenant.',
      [{ field: 'customer_id', message: 'Client requis, absent ou inconnu de ce tenant.' }],
    );
  }
  if (value.code === '23514') {
    return new ProjectCommandRejectedError('api.validation_failed', value.message ?? 'Validation impossible.');
  }
  return error instanceof Error ? error : new Error(String(error));
}
