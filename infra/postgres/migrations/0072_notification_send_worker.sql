create function magrit.claim_notification_messages(
  requested_limit integer default 25,
  requested_max_attempts integer default 5,
  requested_max_age_seconds integer default 86400
)
returns setof public.notification_logs
language plpgsql
security invoker
set search_path=pg_catalog,public,magrit
as $$
begin
  if requested_limit < 0 then
    raise exception using errcode='22023',message='notification_claim_invalid_limit';
  end if;
  if requested_max_attempts < 1 then
    raise exception using errcode='22023',message='notification_claim_invalid_max_attempts';
  end if;
  if requested_max_age_seconds < 1 then
    raise exception using errcode='22023',message='notification_claim_invalid_max_age';
  end if;

  return query
  with candidates as materialized (
    select message.id,message.created_at,message.attempts
      from public.notification_logs message
     where message.status='pending'
       and message.recipient is not null
       and message.attempts<requested_max_attempts
       and message.next_attempt_at<=clock_timestamp()
     order by message.created_at,message.id
     limit requested_limit
     for update skip locked
  ),
  stale as materialized (
    select candidate.id
      from candidates candidate
     where candidate.created_at
       < clock_timestamp()-make_interval(secs=>requested_max_age_seconds)
  ),
  rebutted as (
    update public.notification_logs message
       set status='failed',
           attempts=requested_max_attempts,
           last_error=format(
             'notification_stale: message du %s trop vieux (fraicheur %s secondes depassee), abandonne sans envoi',
             message.created_at,
             requested_max_age_seconds
           )
      from stale
     where message.id=stale.id
    returning message.id
  ),
  fresh as materialized (
    select candidate.id
      from candidates candidate
     where not exists(select 1 from stale where stale.id=candidate.id)
  ),
  claimed as (
    update public.notification_logs message
       set attempts=message.attempts+1,
           next_attempt_at=clock_timestamp()
             + power(5,least(message.attempts+1,4)-1)::numeric*interval '1 minute'
      from fresh
     where message.id=fresh.id
    returning message.*
  )
  select claimed.* from claimed;
end $$;

revoke all on function magrit.claim_notification_messages(integer,integer,integer)
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.claim_notification_messages(integer,integer,integer)
  to magrit_worker;

comment on function magrit.claim_notification_messages(integer,integer,integer) is
  'Réservation atomique du drain de notifications : SKIP LOCKED, backoff 1/5/25/125 minutes et rebut par ancienneté. Réservée à magrit_worker.';
