-- UM1 — seul le profil admin hérite de l'accès aux sous-espaces.

create or replace function public.is_subtenant_member_inherited(p_tenant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
      from public.tenants tenant
      join public.tenant_members member
        on member.tenant_id = tenant.parent_tenant_id
     where tenant.id = p_tenant_id
       and tenant.parent_tenant_id is not null
       and member.user_id = auth.uid()
       and member.access_scope = 'magrit_full'
       and member.role = 'admin'
  );
$$;

grant execute on function public.is_subtenant_member_inherited(uuid) to authenticated;
notify pgrst, 'reload schema';
