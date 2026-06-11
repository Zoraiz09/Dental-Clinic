import type { QueryClient } from '@tanstack/react-query';

/**
 * Single source of truth for every React Query cache key in the app.
 *
 * Before this existed, ~15 screens hard-coded raw string keys
 * (`['bills']`, `['p-bills', id]`, `['provider-bills']`, …). That made
 * invalidation guesswork: a screen could refetch `['bills']` but forget
 * the patient- and provider-scoped copies of the same data, leaving the
 * UI stale. Centralising the keys lets the invalidation **groups** below
 * stay correct in one place.
 *
 * Keys are returned `as const` so call sites are type-checked and the
 * arrays remain referentially stable in shape.
 */
export const qk = {
  patients: (search = '') => ['patients', search] as const,
  patient: (id: string) => ['patient', id] as const,

  appointments: () => ['appointments'] as const,
  // Day-scoped: the key carries the date so the cache rolls over at midnight.
  appointmentsToday: (day: string) => ['appointments', 'today', day] as const,
  apptTypes: () => ['apptTypes'] as const,
  providers: () => ['providers'] as const,
  slots: () => ['slots'] as const,

  bills: () => ['bills'] as const,
  openBills: () => ['bills', 'open'] as const,
  providerBills: (providerId?: string) => ['provider-bills', providerId] as const,

  // Dashboard aggregates (server-side RPCs; see migration 0013). All share
  // the ['dashboard'] prefix so one invalidation refreshes every widget.
  dashboardKpis: (day: string) => ['dashboard', 'kpis', day] as const,
  trends: (unit: 'day' | 'month') => ['dashboard', 'trends', unit] as const,
  providerShares: () => ['dashboard', 'shares'] as const,
  outstanding: () => ['dashboard', 'outstanding'] as const,
  doctorPatients: (providerId?: string) => ['dashboard', 'doctor-patients', providerId] as const,

  inventory: () => ['inventory'] as const,
  stockMovements: () => ['stockMovements'] as const,
  expenses: () => ['expenses'] as const,
  staff: () => ['staff'] as const,
  followUps: (providerId?: string) => ['followups', providerId] as const,
  notifications: () => ['notifications'] as const,

  // Patient-detail tabs (per-patient history).
  patientVisits: (id: string) => ['p-visits', id] as const,
  patientEmr: (id: string) => ['p-emr', id] as const,
  patientRx: (id: string) => ['p-rx', id] as const,
  patientBills: (id: string) => ['p-bills', id] as const,
} as const;

/**
 * Key *prefixes* grouped by the domain event that should invalidate them.
 * React Query matches by prefix, so `['bills']` invalidates every
 * `['bills', …]` and `['provider-bills']` invalidates `['provider-bills', id]`.
 *
 * Use these instead of listing keys ad-hoc at each call site so that, e.g.,
 * completing a session reliably refreshes the global bill list, the doctor's
 * earnings, AND the patient's bills tab — the trio that previously drifted.
 */
// Every domain event that changes money/visit/stock numbers also refreshes
// the server-side dashboard aggregates (['dashboard'] prefix).
const DASHBOARD = ['dashboard'] as const;
const BILL_KEYS = [['bills'], ['provider-bills'], ['p-bills'], DASHBOARD] as const;
const APPOINTMENT_KEYS = [['appointments'], ['slots'], ['p-visits'], DASHBOARD] as const;

export const invalidationGroups = {
  patients: [['patients'], ['patient'], DASHBOARD],
  appointments: APPOINTMENT_KEYS,
  bills: BILL_KEYS,
  /** A completed visit touches the appointment, its bill, and (via inventory) expenses. */
  sessionCompleted: [...APPOINTMENT_KEYS, ...BILL_KEYS, ['expenses']],
  inventory: [['inventory'], ['stockMovements'], ['expenses'], DASHBOARD],
  expenses: [['expenses'], DASHBOARD],
  staff: [['staff'], ['providers']],
  services: [['apptTypes'], ['appointments']],
  emr: [['p-emr']],
  prescriptions: [['p-rx']],
} as const;

type Group = keyof typeof invalidationGroups;

/**
 * Invalidate one or more domain groups in a single call:
 *   invalidate(qc, 'sessionCompleted')
 * Replaces scattered `qc.invalidateQueries({ queryKey: [...] })` lines and
 * guarantees the full fan-out for each event is applied consistently.
 */
export function invalidate(qc: QueryClient, ...groups: Group[]): void {
  for (const group of groups) {
    for (const key of invalidationGroups[group]) {
      qc.invalidateQueries({ queryKey: key as readonly unknown[] });
    }
  }
}
