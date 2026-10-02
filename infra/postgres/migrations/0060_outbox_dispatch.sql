create function magrit.claim_outbox_events(
  requested_limit integer default 25,
  requested_max_attempts integer default 5,
  requested_max_age_seconds integer default 86400
)
returns setof public.outbox_events
language plpgsql
security invoker
set search_path=pg_catalog,public,magrit
as $$
begin
  if requested_limit < 0 then
    raise exception using errcode='22023',message='outbox_claim_invalid_limit';
  end if;
  if requested_max_attempts < 1 then
    raise exception using errcode='22023',message='outbox_claim_invalid_max_attempts';
  end if;
  if requested_max_age_seconds < 1 then
    raise exception using errcode='22023',message='outbox_claim_invalid_max_age';
  end if;

  return query
  with candidates as materialized (
    select event.id,event.occurred_at,event.delivery_attempts
      from public.outbox_events event
     where event.published_at is null
       and event.delivery_attempts < requested_max_attempts
       and event.next_attempt_at <= clock_timestamp()
     order by event.occurred_at,event.id
     limit requested_limit
     for update skip locked
  ),
  stale as materialized (
    select candidate.id
      from candidates candidate
     where candidate.occurred_at
       < clock_timestamp() - make_interval(secs=>requested_max_age_seconds)
  ),
  rebutted as (
    update public.outbox_events event
       set delivery_attempts=requested_max_attempts,
           last_error=format(
             'outbox_stale: evenement du %s trop vieux (fraicheur %s secondes depassee), mis au rebut sans remise',
             event.occurred_at,
             requested_max_age_seconds
           )
      from stale
     where event.id=stale.id
    returning event.id
  ),
  fresh as materialized (
    select candidate.id
      from candidates candidate
     where not exists(select 1 from stale where stale.id=candidate.id)
  ),
  claimed as (
    update public.outbox_events event
       set delivery_attempts=event.delivery_attempts+1,
           next_attempt_at=clock_timestamp()
             + power(5,least(event.delivery_attempts+1,4)-1)::numeric*interval '1 minute'
      from fresh
     where event.id=fresh.id
    returning event.*
  )
  select claimed.* from claimed;
end $$;

revoke all on function magrit.claim_outbox_events(integer,integer,integer)
  from public,magrit_api,magrit_readonly;
grant execute on function magrit.claim_outbox_events(integer,integer,integer)
  to magrit_worker;

comment on function magrit.claim_outbox_events(integer,integer,integer) is
  'Réservation atomique du drain portable : SKIP LOCKED, backoff 1/5/25/125 minutes et rebut par ancienneté. Réservée à magrit_worker.';
