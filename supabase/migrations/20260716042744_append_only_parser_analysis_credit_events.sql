-- Append-only lifecycle events for parser-analysis credit reservations.

create table public.parser_analysis_credit_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.parser_analysis_credit_reservations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('reserved', 'consumed', 'refunded')),
  created_at timestamptz not null default now()
);

comment on table public.parser_analysis_credit_events is
  'Append-only lifecycle events for parser-analysis credit reservations. Event ownership is derived from the reservation by the database trigger.';

create unique index parser_analysis_credit_events_one_reserved_idx
  on public.parser_analysis_credit_events (reservation_id)
  where event_type = 'reserved';

create unique index parser_analysis_credit_events_one_terminal_idx
  on public.parser_analysis_credit_events (reservation_id)
  where event_type in ('consumed', 'refunded');

create index parser_analysis_credit_events_user_created_at_idx
  on public.parser_analysis_credit_events (user_id, created_at desc);

alter table public.parser_analysis_credit_events enable row level security;

revoke all on table public.parser_analysis_credit_events from public;
revoke all on table public.parser_analysis_credit_events from anon;
revoke all on table public.parser_analysis_credit_events from authenticated;
grant select on table public.parser_analysis_credit_events to authenticated;

create policy "parser analysis credit events select own"
on public.parser_analysis_credit_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create function public.capture_parser_analysis_credit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.parser_analysis_credit_events (
      reservation_id,
      user_id,
      event_type,
      created_at
    ) values (
      new.id,
      new.user_id,
      'reserved',
      new.created_at
    );
  elsif old.state = 'reserved'
    and new.state in ('consumed', 'refunded')
    and new.state is distinct from old.state
  then
    insert into public.parser_analysis_credit_events (
      reservation_id,
      user_id,
      event_type,
      created_at
    ) values (
      new.id,
      new.user_id,
      new.state,
      new.finalized_at
    );
  end if;

  return new;
end;
$$;

comment on function public.capture_parser_analysis_credit_event() is
  'Records reservation lifecycle transitions in the append-only event ledger within the reservation transaction.';

revoke all on function public.capture_parser_analysis_credit_event() from public;
revoke all on function public.capture_parser_analysis_credit_event() from anon;
revoke all on function public.capture_parser_analysis_credit_event() from authenticated;

-- Backfill deterministically when reservations predate this event ledger.
insert into public.parser_analysis_credit_events (
  reservation_id,
  user_id,
  event_type,
  created_at
)
select
  reservation.id,
  reservation.user_id,
  'reserved',
  reservation.created_at
from public.parser_analysis_credit_reservations as reservation
on conflict do nothing;

insert into public.parser_analysis_credit_events (
  reservation_id,
  user_id,
  event_type,
  created_at
)
select
  reservation.id,
  reservation.user_id,
  reservation.state,
  reservation.finalized_at
from public.parser_analysis_credit_reservations as reservation
where reservation.state in ('consumed', 'refunded')
on conflict do nothing;

create trigger parser_analysis_credit_events_after_insert
after insert on public.parser_analysis_credit_reservations
for each row
execute function public.capture_parser_analysis_credit_event();

create trigger parser_analysis_credit_events_after_state_update
after update of state on public.parser_analysis_credit_reservations
for each row
execute function public.capture_parser_analysis_credit_event();
