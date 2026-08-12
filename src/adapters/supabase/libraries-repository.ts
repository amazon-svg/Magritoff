import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { CreateLibrary, LibraryDto, UpdateLibrary } from '../../modules/libraries/api/contracts.ts';
import {
  LibraryRejectedError,
  type LibrariesRepository,
} from '../../modules/libraries/application/libraries-repository.ts';
import type { Database } from '../../types/database.types.ts';

type LibraryRow = Database['public']['Tables']['libraries']['Row'];

export class SupabaseLibrariesRepository implements LibrariesRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(_actor: UserId, tenantId: string): Promise<LibraryDto[]> {
    const { data, error } = await this.client
      .from('libraries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw rejected(error);
    return (data ?? []).map(toDto);
  }

  async create(actor: UserId, tenantId: string, input: CreateLibrary): Promise<LibraryDto> {
    const { data, error } = await this.client
      .from('libraries')
      .insert({ user_id: actor, tenant_id: tenantId, name: input.name, description: input.description })
      .select()
      .single();
    if (error || !data) throw classified(error);
    return toDto(data);
  }

  async update(_actor: UserId, tenantId: string, id: string, input: UpdateLibrary): Promise<LibraryDto> {
    const patch: Database['public']['Tables']['libraries']['Update'] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    const { data, error } = await this.client
      .from('libraries')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw classified(error);
    if (!data) throw notFound();
    return toDto(data);
  }

  async remove(_actor: UserId, tenantId: string, id: string): Promise<void> {
    const { data, error } = await this.client
      .from('libraries')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw classified(error);
    if (!data) throw notFound();
  }
}

function toDto(row: LibraryRow): LibraryDto {
  return {
    id: row.id,
    tenant_id: row.tenant_id ?? undefined,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? '',
    created_at: row.created_at,
  };
}

function rejected(error: { message?: string }): LibraryRejectedError {
  return new LibraryRejectedError('permission_denied', error.message ?? 'Accès bibliothèque refusé.');
}

function classified(error: { code?: string; message?: string } | null): LibraryRejectedError {
  return error?.code === '23502'
    ? new LibraryRejectedError('invalid_library', error.message ?? 'Bibliothèque invalide.')
    : rejected(error ?? {});
}

function notFound(): LibraryRejectedError {
  return new LibraryRejectedError('not_found', 'Bibliothèque introuvable.');
}
