-- Les objets gérés par Supabase Storage appartiennent à la plateforme : leur
-- origine dépend de l'environnement et ne doit pas être persistée en donnée
-- métier. Les URL de ressources externes ne sont pas modifiées.

update public.shops
set logo_url = regexp_replace(
  logo_url,
  '^https?://[^/]+(/storage/v1/object/.*)$',
  '\1'
)
where logo_url ~ '^https?://[^/]+/storage/v1/object/';

update public.shops
set hero_image_url = regexp_replace(
  hero_image_url,
  '^https?://[^/]+(/storage/v1/object/.*)$',
  '\1'
)
where hero_image_url ~ '^https?://[^/]+/storage/v1/object/';

update public.shop_template_mockups
set mockup_image_url = regexp_replace(
  mockup_image_url,
  '^https?://[^/]+(/storage/v1/object/.*)$',
  '\1'
)
where mockup_image_url ~ '^https?://[^/]+/storage/v1/object/';

notify pgrst, 'reload schema';
