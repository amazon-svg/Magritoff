-- Diagnostic des conversations pour le user connecté.
-- À exécuter dans le SQL Editor du dashboard Supabase.

-- 1) Voir toutes les conversations (tout utilisateur confondu)
-- pour repérer d'éventuelles rows orphelines.
select id, user_id, title, timestamp,
       jsonb_array_length(coalesce(messages, '[]'::jsonb)) as msg_count,
       jsonb_array_length(coalesce(products, '[]'::jsonb)) as prod_count
from public.conversations
order by timestamp desc;

-- 2) Voir les users présents dans auth.users
select id, email, created_at from auth.users order by created_at desc;

-- ─── NETTOYAGE (décommenter si nécessaire) ───────────────────────────────────

-- Option A : supprimer TOUTES tes conversations pour repartir à zéro.
-- Remplace 'ton-email@example.com' par l'email que tu utilises.
-- delete from public.conversations
-- where user_id = (select id from auth.users where email = 'ton-email@example.com');

-- Option B : supprimer une conv spécifique par id.
-- delete from public.conversations where id = 'conv-1776507571004';
