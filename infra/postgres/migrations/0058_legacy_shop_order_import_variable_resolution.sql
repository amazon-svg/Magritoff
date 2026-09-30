alter function magrit.import_legacy_shop_order(
  uuid,uuid,text,text,text,jsonb,numeric,numeric,text,text,timestamptz
) set plpgsql.variable_conflict='use_variable';

comment on function magrit.import_legacy_shop_order(
  uuid,uuid,text,text,text,jsonb,numeric,numeric,text,text,timestamptz
) is
  'Fonction de cutover reservee au role de migration ; les noms ambigus PL/pgSQL designent explicitement ses variables.';
