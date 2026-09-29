-- Distingue les fichiers communicables au client des fichiers strictement
-- internes et autorise les gabarits SVG produits par HopeStudio.

alter table public.commercial_files
  add column if not exists visibility text not null default 'internal';

alter table public.commercial_files
  drop constraint if exists commercial_files_visibility_check;

alter table public.commercial_files
  add constraint commercial_files_visibility_check
  check (visibility in ('internal', 'customer'));

update storage.buckets
set allowed_mime_types = coalesce(allowed_mime_types, array[]::text[]) || array['image/svg+xml']
where id = 'commercial_line_files'
  and not ('image/svg+xml' = any(coalesce(allowed_mime_types, array[]::text[])));

-- Surcharge rétrocompatible de l'attachement HopeStudio. L'ancienne
-- signature reste disponible et conserve son défaut fermé `internal`.
create or replace function public.api_attach_project_item_file(
  p_tenant_id uuid,
  p_project_id uuid,
  p_project_item_id uuid,
  p_file_id uuid,
  p_kind text,
  p_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_storage_path text,
  p_visibility text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_visibility not in ('internal', 'customer') then
    raise exception 'commercial_file.visibility_invalid';
  end if;

  perform public.api_attach_project_item_file(
    p_tenant_id, p_project_id, p_project_item_id, p_file_id, p_kind,
    p_filename, p_content_type, p_byte_size, p_storage_path
  );

  update public.commercial_files
  set visibility = p_visibility
  where id = p_file_id and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.api_attach_project_item_file(uuid, uuid, uuid, uuid, text, text, text, bigint, text, text)
  from public, anon;
grant execute on function public.api_attach_project_item_file(uuid, uuid, uuid, uuid, text, text, text, bigint, text, text)
  to authenticated;

-- Même surcharge pour les ajouts manuels depuis une ligne projet/devis/commande.
create or replace function public.api_attach_commercial_line_file(
  p_tenant_id uuid,
  p_line_type text,
  p_line_id uuid,
  p_file_id uuid,
  p_kind text,
  p_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_storage_path text,
  p_visibility text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_visibility not in ('internal', 'customer') then
    raise exception 'commercial_file.visibility_invalid';
  end if;

  perform public.api_attach_commercial_line_file(
    p_tenant_id, p_line_type, p_line_id, p_file_id, p_kind,
    p_filename, p_content_type, p_byte_size, p_storage_path
  );

  update public.commercial_files
  set visibility = p_visibility
  where id = p_file_id and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.api_attach_commercial_line_file(uuid, text, uuid, uuid, text, text, text, bigint, text, text)
  from public, anon;
grant execute on function public.api_attach_commercial_line_file(uuid, text, uuid, uuid, text, text, text, bigint, text, text)
  to authenticated;
