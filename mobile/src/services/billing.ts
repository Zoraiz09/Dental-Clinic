import { AppointmentType, Provider } from '../types/models';

/**
 * Shared billing math — the single source of truth for how a visit's fees
 * split between doctor and clinic. Mirrors the columns on `bills` and the
 * logic inside the complete_session DB function (migration 0009); if the
 * split rule ever changes, update it here AND in that SQL function.
 */

/**
 * The revenue-share % a doctor earns on a visit: the doctor's own share
 * (set by the admin on their provider row) wins; otherwise fall back to the
 * appointment type's default. 0 when neither is set.
 */
export function effectiveSharePct(
  provider?: Pick<Provider, 'default_share_pct'> | null,
  type?: Pick<AppointmentType, 'default_doctor_pct'> | null,
): number {
  return provider?.default_share_pct || type?.default_doctor_pct || 0;
}

/** The doctor's share in rupees for the given fees at the given %. */
export function doctorShareFor(consultationFee: number, testFee: number, sharePct: number): number {
  return Math.round(((consultationFee + testFee) * sharePct) / 100);
}

/**
 * Derive a bill's stored amounts from its inputs: total after discount, the
 * doctor's share clamped so it can never exceed the total, and the clinic's
 * remainder. Matches the DB's generated/trigger-maintained columns.
 */
export function computeBillTotals(input: {
  consultation_fee: number;
  test_fee: number;
  discount: number;
  doctor_share: number;
}): { total_amount: number; doctor_share: number; clinic_share: number } {
  const total_amount = input.consultation_fee + input.test_fee - input.discount;
  const doctor_share = Math.min(input.doctor_share, total_amount);
  return { total_amount, doctor_share, clinic_share: total_amount - doctor_share };
}
