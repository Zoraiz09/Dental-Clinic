-- =====================================================================
-- Noor Dentofacial Clinic — 0009 Complete session (+ auto-bill)
-- =====================================================================
-- Lets the assigned DOCTOR (or admin/receptionist) mark a visit COMPLETED
-- and generates the bill in the same step. Runs SECURITY DEFINER so the
-- doctor — who normally can't insert bills — can finalize their session.
-- Requires migration 0007 (providers.default_share_pct).
-- (Uses scalar variables — no table row-types — for max compatibility.)
-- =====================================================================

create or replace function public.complete_session(p_appt uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient   uuid;
  v_provider  uuid;
  v_type_id   uuid;
  v_consult   numeric := 0;
  v_test      numeric := 0;
  v_type_pct  numeric := 0;
  v_share_pct numeric := 0;
  v_total     numeric := 0;
  v_pct       numeric := 0;
  v_bill_id   uuid;
begin
  select patient_id, provider_id, appointment_type_id
    into v_patient, v_provider, v_type_id
    from public.appointments
   where id = p_appt;
  if not found then raise exception 'Appointment not found'; end if;

  -- Authorize: admin, receptionist, or the doctor assigned to this visit.
  if not (
    public.has_role(array['ADMIN','RECEPTIONIST']::user_role[])
    or (public.has_role(array['DOCTOR']::user_role[]) and v_provider = public.current_provider_id())
  ) then
    raise exception 'Not allowed to complete this session';
  end if;

  update public.appointments set status = 'COMPLETED' where id = p_appt;

  -- One bill per appointment.
  select id into v_bill_id from public.bills where appointment_id = p_appt limit 1;
  if v_bill_id is not null then return v_bill_id; end if;

  select consultation_fee, test_fee, default_doctor_pct
    into v_consult, v_test, v_type_pct
    from public.appointment_types
   where id = v_type_id;

  select default_share_pct into v_share_pct
    from public.providers
   where id = v_provider;

  v_total := coalesce(v_consult, 0) + coalesce(v_test, 0);
  v_pct   := coalesce(nullif(v_share_pct, 0), v_type_pct, 0);

  insert into public.bills (invoice_no, patient_id, appointment_id, provider_id,
                            consultation_fee, test_fee, discount, doctor_share)
  values (
    'INV-' || to_char(now(), 'YYMMDDHH24MISS'),
    v_patient, p_appt, v_provider,
    coalesce(v_consult, 0), coalesce(v_test, 0), 0,
    round(v_total * v_pct / 100, 2)
  )
  returning id into v_bill_id;

  return v_bill_id;
end;
$$;

grant execute on function public.complete_session(uuid) to authenticated;
