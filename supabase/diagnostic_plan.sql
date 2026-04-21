-- A) Est-ce que la colonne "plan" existe dans user_preferences ?
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'user_preferences'
order by ordinal_position;

-- B) Que contient MA ligne user_preferences ?
-- (le SQL Editor s'exécute en tant que postgres, pas en tant que toi,
-- donc on lit toutes les lignes pour inspection)
select user_id, plan, theme, language, notifications_email, updated_at
from public.user_preferences
order by updated_at desc
limit 10;
