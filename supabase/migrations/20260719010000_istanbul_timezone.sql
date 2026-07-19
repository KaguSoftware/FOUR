-- Timezone is Istanbul (UTC+3, no DST since 2016), not Berlin.

alter table public.system_state
  alter column timezone set default 'Europe/Istanbul';

create or replace function public.logical_date(tz text default 'Europe/Istanbul')
returns date
language sql
stable
as $$
  select ((now() at time zone tz) - interval '4 hours')::date;
$$;

-- Move any row still on the old default.
update public.system_state
   set timezone = 'Europe/Istanbul'
 where timezone = 'Europe/Berlin';
