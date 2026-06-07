-- =====================================================================
-- Noor Dentofacial Clinic — 0010 EMR write scoping
-- =====================================================================
-- A DOCTOR may only create/edit EMR (charting) for a patient they have
-- an appointment with. Admin keeps full access. Receptionists never write
-- EMR (unchanged). Mirrors the patient-visibility rule from 0007.
-- =====================================================================

drop policy if exists emr_clinical_write on public.emr;

-- Admin: full access.
create policy emr_admin_write on public.emr
  for all
  using (public.has_role(array['ADMIN']::user_role[]))
  with check (public.has_role(array['ADMIN']::user_role[]));

-- Doctor: only for patients they are (or were) scheduled with.
create policy emr_doctor_write on public.emr
  for all
  using (
    public.has_role(array['DOCTOR']::user_role[])
    and exists (
      select 1 from public.appointments a
      where a.patient_id = emr.patient_id
        and a.provider_id = public.current_provider_id()
    )
  )
  with check (
    public.has_role(array['DOCTOR']::user_role[])
    and exists (
      select 1 from public.appointments a
      where a.patient_id = emr.patient_id
        and a.provider_id = public.current_provider_id()
    )
  );
