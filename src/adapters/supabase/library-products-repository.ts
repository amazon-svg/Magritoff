import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId } from '../../kernel/ids/index.ts';
import type { LibraryProductDto, LibraryProductInput, UpdateLibraryProduct } from '../../modules/libraries/api/product-contracts.ts';
import {
  LibraryProductRejectedError,
  type LibraryProductsRepository,
} from '../../modules/libraries/application/library-products-repository.ts';
import type { Database, Json } from '../../types/database.types.ts';

type ProductRow = Database['public']['Tables']['product_library']['Row'];
type ProductInsert = Database['public']['Tables']['product_library']['Insert'];
type ProductUpdate = Database['public']['Tables']['product_library']['Update'];
const PIM_GENERATED_SOURCE = 'pim-generated';

export class SupabaseLibraryProductsRepository implements LibraryProductsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(_actor: UserId, tenantId: string): Promise<LibraryProductDto[]> {
    const { data, error } = await this.client.from('product_library').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw rejected(error);
    return (data ?? []).map(toDto);
  }

  async create(actor: UserId, tenantId: string, input: LibraryProductInput): Promise<LibraryProductDto> {
    const { data, error } = await this.client.from('product_library').insert(toInsert(actor, tenantId, input)).select().single();
    if (error || !data) throw classified(error);
    return toDto(data);
  }

  async createMany(actor: UserId, tenantId: string, products: LibraryProductInput[]): Promise<LibraryProductDto[]> {
    const { data, error } = await this.client.from('product_library').insert(products.map((product) => toInsert(actor, tenantId, product))).select();
    if (error || !data) throw classified(error);
    return data.map(toDto);
  }

  async replacePimGenerated(actor: UserId, tenantId: string, products: LibraryProductInput[]): Promise<number> {
    const { error: removeError } = await this.client.from('product_library').delete().eq('tenant_id', tenantId).filter('config->>source', 'eq', PIM_GENERATED_SOURCE);
    if (removeError) throw rejected(removeError);
    const inserted = await this.createMany(actor, tenantId, products);
    return inserted.length;
  }

  async clearPimGenerated(_actor: UserId, tenantId: string): Promise<number> {
    const { data, error } = await this.client.from('product_library').delete().eq('tenant_id', tenantId).filter('config->>source', 'eq', PIM_GENERATED_SOURCE).select('id');
    if (error) throw rejected(error);
    return data?.length ?? 0;
  }

  async update(_actor: UserId, tenantId: string, id: string, input: UpdateLibraryProduct): Promise<LibraryProductDto> {
    const patch = toUpdate(input);
    const { data, error } = await this.client.from('product_library').update(patch).eq('tenant_id', tenantId).eq('id', id).select().maybeSingle();
    if (error) throw classified(error);
    if (!data) throw notFound();
    return toDto(data);
  }

  async remove(_actor: UserId, tenantId: string, id: string): Promise<void> {
    const { data, error } = await this.client.from('product_library').delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw classified(error);
    if (!data) throw notFound();
  }
}

function toInsert(actor: UserId, tenantId: string, input: LibraryProductInput): ProductInsert {
  return {
    user_id: actor,
    tenant_id: tenantId,
    library_id: input.library_id,
    name: input.name,
    category: input.category,
    description: input.description,
    price_ht: input.price_ht,
    image_url: input.image_url,
    config: input.config as Json,
    active: input.active,
    gamme_slug: input.gamme_slug ?? null,
  };
}

function toUpdate(input: UpdateLibraryProduct): ProductUpdate {
  const patch: ProductUpdate = {};
  if (input.library_id !== undefined) patch.library_id = input.library_id;
  if (input.name !== undefined) patch.name = input.name;
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.price_ht !== undefined) patch.price_ht = input.price_ht;
  if (input.image_url !== undefined) patch.image_url = input.image_url;
  if (input.config !== undefined) patch.config = input.config as Json;
  if (input.active !== undefined) patch.active = input.active;
  if (input.gamme_slug !== undefined) patch.gamme_slug = input.gamme_slug;
  return patch;
}

function toDto(row: ProductRow): LibraryProductDto {
  return {
    id: row.id,
    ...(row.tenant_id ? { tenant_id: row.tenant_id } : {}),
    user_id: row.user_id,
    name: row.name,
    category: row.category,
    description: row.description ?? '',
    price_ht: row.price_ht,
    image_url: row.image_url ?? '',
    config: row.config as Record<string, unknown>,
    active: row.active,
    library_id: row.library_id,
    gamme_slug: row.gamme_slug,
    created_at: row.created_at,
  };
}

function rejected(error: { message?: string }): LibraryProductRejectedError {
  return new LibraryProductRejectedError('permission_denied', error.message ?? 'Accès produit refusé.');
}
function classified(error: { code?: string; message?: string } | null): LibraryProductRejectedError {
  return error?.code?.startsWith('23')
    ? new LibraryProductRejectedError('invalid_product', error.message ?? 'Produit invalide.')
    : rejected(error ?? {});
}
function notFound(): LibraryProductRejectedError {
  return new LibraryProductRejectedError('not_found', 'Produit introuvable.');
}
