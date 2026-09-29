-- Ajout de fichiers typés directement depuis une ligne projet, devis ou commande.
-- La fonction centralise les contrôles de tenant et laisse les triggers existants
-- propager les associations vers les lignes dérivées.

create or replace function public.api_attach_commercial_line_file(
  p_tenant_id uuid,
  p_line_type text,
  p_line_id uuid,
  p_file_id uuid,
  p_kind text,
  p_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_storage_path text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_super_admin() and not exists (
    select 1 from public.tenant_members tm
    where tm.tenant_id = p_tenant_id and tm.user_id = auth.uid()
      and tm.role in ('admin', 'member')
  ) then
    raise exception 'commercial_line.file_forbidden';
  end if;

  if p_line_type = 'project_item' then
    if not exists (
      select 1 from public.project_items pi
      join public.projects p on p.id = pi.project_id
      where pi.id = p_line_id and p.tenant_id = p_tenant_id
    ) then raise exception 'commercial_line.not_found'; end if;
  elsif p_line_type = 'quote_line' then
    if not exists (
      select 1 from public.commercial_quote_lines ql
      join public.commercial_quotes q on q.id = ql.quote_id
      where ql.id = p_line_id and q.tenant_id = p_tenant_id
    ) then raise exception 'commercial_line.not_found'; end if;
  elsif p_line_type = 'order_line' then
    if not exists (
      select 1 from public.commercial_order_lines ol
      join public.commercial_orders o on o.id = ol.order_id
      where ol.id = p_line_id and o.tenant_id = p_tenant_id
    ) then raise exception 'commercial_line.not_found'; end if;
  else
    raise exception 'commercial_line.type_invalid';
  end if;

  insert into public.commercial_files (
    id, tenant_id, kind, filename, content_type, byte_size, storage_path
  ) values (
    p_file_id, p_tenant_id, p_kind, p_filename, p_content_type, p_byte_size, p_storage_path
  );

  if p_line_type = 'project_item' then
    insert into public.project_item_files (project_item_id, file_id) values (p_line_id, p_file_id);
  elsif p_line_type = 'quote_line' then
    insert into public.commercial_quote_line_files (quote_line_id, file_id) values (p_line_id, p_file_id);
  else
    insert into public.commercial_order_line_files (order_line_id, file_id) values (p_line_id, p_file_id);
  end if;
end;
$$;

revoke all on function public.api_attach_commercial_line_file(uuid, text, uuid, uuid, text, text, text, bigint, text)
  from public, anon;
grant execute on function public.api_attach_commercial_line_file(uuid, text, uuid, uuid, text, text, text, bigint, text)
  to authenticated;
