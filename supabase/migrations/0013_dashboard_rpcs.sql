-- =====================================================================
-- Noor Dentofacial Clinic — 0013 Dashboard read-scaling RPCs
-- =====================================================================
-- Home/Reports previously downloaded whole tables (bills, appointments,
-- patients, expenses, stock_movements) and aggregated on the device.
-- These functions move the aggregation into Postgres so the dashboards
-- transfer a handful of numbers instead of every row ever created.
-- Pattern follows get_doctor_earnings (0005): SECURITY DEFINER with an
-- explicit has_role() gate, granted to authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Indexes backing the date-ranged scans below (and the ranged
-- appointment/bill list queries the app now issues).
-- ---------------------------------------------------------------------
create index if not exists bills_created_idx          on public.bills (created_at);
create index if not exists appointments_scheduled_idx on public.appointments (scheduled_for);
create index if not exists stock_movements_created_idx on public.stock_movements (created_at);
create index if not exists patients_created_idx       on public.patients (created_at);

-- ---------------------------------------------------------------------
-- KPI snapshot. [p_from, p_to) is the clinic's "today" window, computed
-- on the device so day boundaries follow the device clock (same
-- behaviour as the old client-side isToday()).
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_kpis(
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  revenue_today         numeric,  -- billed (non-cancelled) in the window
  items_purchased_today numeric,  -- stock ADD cost in the window
  items_used_today      numeric,  -- stock DEDUCT cost in the window
  appts_today           bigint,   -- scheduled in window, not cancelled
  checked_in            bigint,   -- currently CHECKED_IN (any day)
  pending_bills         bigint,   -- PENDING or PARTIAL
  low_stock             bigint,   -- active items at/below reorder level
  new_patients_today    bigint,
  total_patients        bigint,
  outstanding           numeric,  -- unpaid remainder over all bills
  expenses_total        numeric,  -- all-time expense ledger sum
  week_revenue          numeric   -- billed in the 7 days ending p_to
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['ADMIN','RECEPTIONIST']::user_role[]) then
    raise exception 'Not allowed';
  end if;

  return query select
    coalesce((select sum(b.total_amount) from public.bills b
              where b.status <> 'CANCELLED' and b.created_at >= p_from and b.created_at < p_to), 0),
    coalesce((select sum(m.quantity * i.unit_cost)
              from public.stock_movements m join public.inventory_items i on i.id = m.item_id
              where m.type = 'ADD' and m.created_at >= p_from and m.created_at < p_to), 0),
    coalesce((select sum(m.quantity * i.unit_cost)
              from public.stock_movements m join public.inventory_items i on i.id = m.item_id
              where m.type = 'DEDUCT' and m.created_at >= p_from and m.created_at < p_to), 0),
    (select count(*) from public.appointments a
      where a.scheduled_for >= p_from and a.scheduled_for < p_to and a.status <> 'CANCELLED'),
    (select count(*) from public.appointments a where a.status = 'CHECKED_IN'),
    (select count(*) from public.bills b where b.status in ('PENDING','PARTIAL')),
    (select count(*) from public.inventory_items i where i.is_active and i.quantity <= i.reorder_level),
    (select count(*) from public.patients p where p.created_at >= p_from and p.created_at < p_to),
    (select count(*) from public.patients),
    coalesce((select sum(b.total_amount - b.amount_paid) from public.bills b
              where b.status <> 'CANCELLED'), 0),
    coalesce((select sum(e.amount) from public.expenses e), 0),
    coalesce((select sum(b.total_amount) from public.bills b
              where b.status <> 'CANCELLED' and b.created_at >= p_to - interval '7 days' and b.created_at < p_to), 0);
end;
$$;

-- ---------------------------------------------------------------------
-- Trend series for the admin charts: one row per day/month bucket,
-- oldest → newest, ending at the current bucket. p_tz controls where
-- the day/month boundaries fall (device timezone is passed in).
-- ---------------------------------------------------------------------
create or replace function public.get_trend_series(
  p_unit  text,                       -- 'day' | 'month'
  p_count int,                        -- number of buckets (e.g. 7 days, 6 months)
  p_tz    text default 'Asia/Karachi'
)
returns table (
  bucket        date,
  revenue       numeric,  -- billed (non-cancelled), bucketed by created_at
  patients_seen bigint,   -- COMPLETED appointments, bucketed by scheduled_for
  expenses      numeric   -- expense ledger, bucketed by spent_at
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_step  interval;
  v_start timestamp;  -- bucket start in clinic-local time
begin
  if not public.has_role(array['ADMIN']::user_role[]) then
    raise exception 'Admins only';
  end if;
  if p_unit not in ('day', 'month') then
    raise exception 'p_unit must be day or month';
  end if;
  if p_count < 1 or p_count > 36 then
    raise exception 'p_count out of range';
  end if;

  v_step  := case when p_unit = 'day' then interval '1 day' else interval '1 month' end;
  v_start := date_trunc(p_unit, now() at time zone p_tz) - (p_count - 1) * v_step;

  return query
  with buckets as (
    select generate_series(v_start, v_start + (p_count - 1) * v_step, v_step) as b
  )
  select
    bk.b::date,
    coalesce((select sum(x.total_amount) from public.bills x
              where x.status <> 'CANCELLED'
                and date_trunc(p_unit, x.created_at at time zone p_tz) = bk.b), 0),
    coalesce((select count(*) from public.appointments a
              where a.status = 'COMPLETED'
                and date_trunc(p_unit, a.scheduled_for at time zone p_tz) = bk.b), 0),
    coalesce((select sum(e.amount) from public.expenses e
              where date_trunc(p_unit, e.spent_at::timestamp) = bk.b), 0)
  from buckets bk
  order by bk.b;
end;
$$;

-- ---------------------------------------------------------------------
-- Per-doctor share totals for the Reports "Doctor earnings" list.
-- ---------------------------------------------------------------------
create or replace function public.get_provider_shares()
returns table (
  provider_id uuid,
  full_name   text,
  title       text,
  share       numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['ADMIN']::user_role[]) then
    raise exception 'Admins only';
  end if;

  return query
  select p.id, p.full_name, p.title, sum(b.doctor_share)::numeric
  from public.bills b
  join public.providers p on p.id = b.provider_id
  where b.status <> 'CANCELLED'
  group by p.id, p.full_name, p.title
  having sum(b.doctor_share) > 0
  order by 4 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Outstanding balances grouped by patient (Reports drill-down).
-- ---------------------------------------------------------------------
create or replace function public.get_outstanding_by_patient()
returns table (
  patient_id uuid,
  full_name  text,
  due        numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(array['ADMIN','RECEPTIONIST']::user_role[]) then
    raise exception 'Not allowed';
  end if;

  return query
  select b.patient_id, pt.full_name, sum(b.total_amount - b.amount_paid)::numeric
  from public.bills b
  join public.patients pt on pt.id = b.patient_id
  where b.status <> 'CANCELLED'
  group by b.patient_id, pt.full_name
  having sum(b.total_amount - b.amount_paid) > 0
  order by 3 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Distinct patients a doctor has ever had an appointment with (the
-- doctor-home "Patients" KPI). Doctors are forced to their own provider
-- id; admins may pass any (mirrors get_doctor_earnings scoping).
-- ---------------------------------------------------------------------
create or replace function public.get_doctor_patient_count(p_provider uuid default null)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if public.has_role(array['ADMIN']::user_role[]) then
    target := coalesce(p_provider, public.current_provider_id());
  else
    target := public.current_provider_id();
  end if;
  if target is null then
    return 0;
  end if;
  return (select count(distinct a.patient_id) from public.appointments a where a.provider_id = target);
end;
$$;

grant execute on function public.get_dashboard_kpis(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_trend_series(text, int, text) to authenticated;
grant execute on function public.get_provider_shares() to authenticated;
grant execute on function public.get_outstanding_by_patient() to authenticated;
grant execute on function public.get_doctor_patient_count(uuid) to authenticated;
