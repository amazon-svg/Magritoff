-- ─────────────────────────────────────────────────────────────────────────
-- Story S4.1a — Bucket Supabase Storage product_mockups + RLS
-- Epic 4 (Mockup Engine) — chemin critique R3 Implementation Readiness
-- ─────────────────────────────────────────────────────────────────────────
-- Cree le bucket Supabase Storage qui accueillera les mockups paramentriques
-- generes par l'Edge Function `mockup-generator` (livree en S4.1c).
--
-- ⚠️ CONVENTION DE PATH (decision Architecture §4.3) :
--   product_mockups/{tenant_id}/{shop_id}/{product_id}.png
-- 3 niveaux UUID/slug. Cohorte avec la structure tenant-scoped des autres
-- ressources Magrit (tenant_orders, tenant_assets, etc.).
--
-- STRATEGIE CACHE (cf. Architecture §4.3) :
--   - Cache write-through : 1 generation = 1 upload Storage + 1 reponse client.
--     Les requetes suivantes hit le CDN public directement.
--   - Pas de TTL automatique. Invalidation explicite via S4.1c future
--     (endpoint POST /api/mockup/invalidate?shop=Y qui supprime les fichiers
--     d'une boutique quand l'admin change le branding).
--
-- FALLBACK (impl en S4.1c, hors scope ici) :
--   - Si Clariprint en panne / payload invalide / template non disponible :
--     l'edge function mockup-generator retourne un picto generique avec un
--     header HTTP `X-Mockup-Fallback: true` pour observabilite.
--
-- POLICIES RLS APPLIQUEES :
--   - SELECT public sur le bucket (tout client peut GET les fichiers via CDN).
--   - INSERT / UPDATE / DELETE : aucune policy → rejet implicite RLS pour les
--     roles `anon` et `authenticated`. Seul le `service_role` (utilise par les
--     edge functions, ex: future mockup-generator) peut ecrire (RLS bypassee
--     par defaut Supabase pour service_role).
--
-- ⚠️ MIME STRICT image/png : limite le bucket aux PNG pour eviter derives
-- (uploads SVG, JPG). Si besoin futur d'autres formats, migration dediee.
-- ⚠️ TAILLE MAX 5 MB par fichier : un mockup PNG 1024×1024 fait typiquement
-- < 500 KB. 5 MB laisse marge pour cas Growth (templates plus complexes).
--
-- IDEMPOTENCE : le `on conflict (id) do update` permet de relancer la
-- migration sans erreur si le bucket existe deja (utile pour resync local /
-- staging / prod).
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. Bucket creation (idempotent) ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product_mockups',
  'product_mockups',
  true,
  5242880,                         -- 5 MB max par fichier
  array['image/png']::text[]       -- MIME strict
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── 2. RLS policies sur storage.objects ──────────────────────────────────
-- Note : Supabase active RLS par defaut sur storage.objects. Sans policy
-- explicite : rejet pour les roles `anon` et `authenticated`. `service_role`
-- bypasse toujours RLS, donc les edge functions n'ont pas besoin de policy.

-- Policy SELECT publique : tout client peut lire les fichiers du bucket
-- (via l'URL publique CDN https://<project>.supabase.co/storage/v1/object/public/product_mockups/...)
drop policy if exists "product_mockups_public_read" on storage.objects;
create policy "product_mockups_public_read"
  on storage.objects
  for select
  using (bucket_id = 'product_mockups');

-- Pas de policy INSERT/UPDATE/DELETE pour anon/authenticated → rejet implicite.
-- Le service_role bypasse RLS, donc les edge functions ecrivent sans probleme.
