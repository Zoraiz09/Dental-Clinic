-- =====================================================================
-- Noor Dentofacial Clinic — 0012 In-app notifications (v2)
-- =====================================================================
-- Event-driven, persistent, per-recipient notifications delivered live via
-- Supabase Realtime. DB triggers write a row the instant the underlying event
-- happens; each user reads/dismisses only their own. SECURITY DEFINER trigger
-- functions are the ONLY writers (no client insert policy).
-- =====================================================================

create table if not exists public.in_app_notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         text not null,                 -- CHECKED_IN | AWAITING_PAYMENT | CANCELLED | PAYMENT_COLLECTED | PAYMENT_PARTIAL | EXPENSE_ADDED | LOW_STOCK
  title        text not null,
  body         text,
  data         jsonb,                          -- routing payload, e.g. { appointment_id, patient_id, bill_id }
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notif_recipient_idx on public.in_app_notifications (recipient_id, created_at desc);

alter table public.in_app_notifications enable row level security;

-- Recipients see and dismiss only their own; no one inserts from the client.
drop policy if exists notif_select_own on public.in_app_notifications;
create policy notif_select_own on public.in_app_notifications
  for select using (recipient_id = auth.uid());
drop policy if exists notif_update_own on public.in_app_notifications;
create policy notif_update_own on public.in_app_notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------------
-- Writer helpers (SECURITY DEFINER → bypass RLS to insert for anyone)
-- ---------------------------------------------------------------------
create or replace function public.create_notification(
  p_recipient uuid, p_type text, p_title text, p_body text, p_data jsonb default null
) returns void language sql security definer set search_path = public as $$
  insert into public.in_app_notifications (recipient_id, type, title, body, data)
  select p_recipient, p_type, p_title, p_body, p_data where p_recipient is not null;
$$;

create or replace function public.notify_roles(
  p_roles user_role[], p_type text, p_title text, p_body text, p_data jsonb default null
) returns void language sql security definer set search_path = public as $$
  insert into public.in_app_notifications (recipient_id, type, title, body, data)
  select id, p_type, p_title, p_body, p_data
  from public.profiles where role = any(p_roles) and is_active;
$$;

-- ---------------------------------------------------------------------
-- Appointment status changes → checked-in / awaiting-payment / cancelled
-- ---------------------------------------------------------------------
create or replace function public.tg_appt_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_patient text; v_prof uuid; v_data jsonb;
begin
  if new.status is distinct from old.status then
    select full_name into v_patient from public.patients where id = new.patient_id;
    select profile_id into v_prof from public.providers where id = new.provider_id;
    v_data := jsonb_build_object('appointment_id', new.id, 'patient_id', new.patient_id);

    if new.status = 'CHECKED_IN' then
      perform public.create_notification(v_prof, 'CHECKED_IN',
        coalesce(v_patient, 'A patient') || ' is checked in', 'In your queue', v_data);
    elsif new.status = 'AWAITING_PAYMENT' then
      perform public.notify_roles(array['ADMIN','RECEPTIONIST']::user_role[], 'AWAITING_PAYMENT',
        'Collect payment from ' || coalesce(v_patient, 'patient'), 'Doctor finished the visit', v_data);
    elsif new.status = 'CANCELLED' then
      perform public.notify_roles(array['ADMIN','RECEPTIONIST']::user_role[], 'CANCELLED',
        'Cancelled: ' || coalesce(v_patient, 'patient'), null, v_data);
      perform public.create_notification(v_prof, 'CANCELLED',
        'Cancelled: ' || coalesce(v_patient, 'patient'), null, v_data);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists appt_notify on public.appointments;
create trigger appt_notify after update on public.appointments
  for each row execute function public.tg_appt_notify();

-- ---------------------------------------------------------------------
-- Payment recorded (bills.amount_paid rises) → notify the doctor
-- ---------------------------------------------------------------------
create or replace function public.tg_bill_paid_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prof uuid; v_patient text;
begin
  if new.amount_paid is distinct from old.amount_paid and new.amount_paid > 0 then
    select profile_id into v_prof from public.providers where id = new.provider_id;
    select full_name into v_patient from public.patients where id = new.patient_id;
    if new.status = 'PAID' then
      perform public.create_notification(v_prof, 'PAYMENT_COLLECTED',
        'Payment collected · ' || coalesce(v_patient, 'patient'),
        'Revenue updated — your share +Rs ' || coalesce(new.doctor_share, 0)::text,
        jsonb_build_object('bill_id', new.id, 'patient_id', new.patient_id));
    else
      perform public.create_notification(v_prof, 'PAYMENT_PARTIAL',
        'Partial payment collected · ' || coalesce(v_patient, 'patient'),
        'Collected Rs ' || new.amount_paid::text || ' of Rs ' || new.total_amount::text,
        jsonb_build_object('bill_id', new.id, 'patient_id', new.patient_id));
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists bill_paid_notify on public.bills;
create trigger bill_paid_notify after update on public.bills
  for each row execute function public.tg_bill_paid_notify();

-- ---------------------------------------------------------------------
-- Expense logged → notify admins (who entered it, for what)
-- ---------------------------------------------------------------------
create or replace function public.tg_expense_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_who text;
begin
  select full_name into v_who from public.profiles where id = new.created_by;
  perform public.notify_roles(array['ADMIN']::user_role[], 'EXPENSE_ADDED',
    'Expense added' || coalesce(' by ' || v_who, ''),
    coalesce(new.description, '') || ' — Rs ' || new.amount::text,
    jsonb_build_object('expense_id', new.id));
  return new;
end; $$;
drop trigger if exists expense_notify on public.expenses;
create trigger expense_notify after insert on public.expenses
  for each row execute function public.tg_expense_notify();

-- ---------------------------------------------------------------------
-- Inventory crosses its reorder level → notify admins (once, on crossing)
-- ---------------------------------------------------------------------
create or replace function public.tg_lowstock_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.quantity <= new.reorder_level and old.quantity > old.reorder_level then
    perform public.notify_roles(array['ADMIN']::user_role[], 'LOW_STOCK',
      'Low stock: ' || new.name,
      new.quantity::text || ' ' || coalesce(new.unit, 'left') || ' · reorder ≤ ' || new.reorder_level::text,
      jsonb_build_object('item_id', new.id));
  end if;
  return new;
end; $$;
drop trigger if exists lowstock_notify on public.inventory_items;
create trigger lowstock_notify after update on public.inventory_items
  for each row execute function public.tg_lowstock_notify();

-- ---------------------------------------------------------------------
-- Stream changes to subscribed clients (Realtime)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.in_app_notifications;
