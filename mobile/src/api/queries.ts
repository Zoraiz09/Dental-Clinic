import dayjs from 'dayjs';
import {
  Appointment, AppointmentType, AppNotification, Bill, DashboardKpis,
  DoctorEarnings, EMR, Expense, InventoryItem, OutstandingBalance, Patient,
  Prescription, Profile, Provider, ProviderShare, StockMovement, TimeSlot,
  TrendPoint,
} from '../types/models';
import { repo } from './repo';
import { TimeRange } from './repo/types';

/**
 * Read-side facade. Every function delegates to the repository
 * (src/api/repo), where the mock/live split lives behind one interface —
 * no function here branches on mock-vs-live anymore. Exported names and
 * signatures are unchanged so screens keep importing from this module.
 */

// --- Patients ---------------------------------------------------------
export const listPatients = (search = ''): Promise<Patient[]> => repo.patients.list(search);
export const getPatient = (id: string): Promise<Patient | null> => repo.patients.get(id);
export const createPatient = (input: Partial<Patient>): Promise<Patient> => repo.patients.create(input);
export const updatePatient = (id: string, input: Partial<Patient>): Promise<Patient> => repo.patients.update(id, input);

// --- Per-patient history (drives the Patient Detail tabs) -------------
export const appointmentsByPatient = (patientId: string): Promise<Appointment[]> => repo.appointments.byPatient(patientId);
export const emrByPatient = (patientId: string): Promise<EMR[]> => repo.emr.byPatient(patientId);
export const prescriptionsByPatient = (patientId: string): Promise<Prescription[]> => repo.prescriptions.byPatient(patientId);
export const billsByPatient = (patientId: string): Promise<Bill[]> => repo.bills.byPatient(patientId);

// Prescriptions whose follow-up lands on the clinic's "today" (optionally for
// one provider). Drives the doctor's "follow-up due" bell notification.
// "Today" is computed here, at call time, so both backends stay clock-free.
export const followUpsDueToday = (providerId?: string): Promise<Prescription[]> =>
  repo.prescriptions.dueOn(dayjs().format('YYYY-MM-DD'), providerId);

// --- Date windows -------------------------------------------------------
/** Today's half-open window [start of day, start of tomorrow), device clock. */
export function todayRange(): TimeRange {
  const start = dayjs().startOf('day');
  return { from: start.toISOString(), to: start.add(1, 'day').toISOString() };
}

/** Device IANA timezone — passed to the trend RPC so day/month bucket
 *  boundaries match what the user's clock shows. */
const deviceTz = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
  } catch {
    return 'Asia/Karachi';
  }
};

// --- Appointments -----------------------------------------------------
export const listAppointments = (range?: TimeRange): Promise<Appointment[]> => repo.appointments.list(range);
/** Only today's appointments — what the Home dashboards actually render. */
export const listTodaysAppointments = (): Promise<Appointment[]> => repo.appointments.list(todayRange());
export const listAppointmentTypes = (): Promise<AppointmentType[]> => repo.services.list();
export const listProviders = (): Promise<Provider[]> => repo.providers.list();
export const listTimeSlots = (providerId?: string): Promise<TimeSlot[]> => repo.timeSlots.list(providerId);

// --- Billing ----------------------------------------------------------
export const listBills = (): Promise<Bill[]> => repo.bills.list();
/** PENDING/PARTIAL only — the front desk's working set. */
export const listOpenBills = (): Promise<Bill[]> => repo.bills.listOpen();
export const billsByProvider = (providerId: string): Promise<Bill[]> => repo.bills.byProvider(providerId);

// --- Inventory --------------------------------------------------------
export const listInventory = (): Promise<InventoryItem[]> => repo.inventory.listItems();

// --- Staff (admin) ----------------------------------------------------
export const listStaff = (): Promise<Profile[]> => repo.staff.list();

// --- Stock movements (for inventory cost vs revenue) ------------------
export const listStockMovements = (): Promise<StockMovement[]> => repo.inventory.listMovements();

// --- Expenses ---------------------------------------------------------
export const listExpenses = (): Promise<Expense[]> => repo.expenses.list();

// --- In-app notifications (v2) ----------------------------------------
export const listMyNotifications = (): Promise<AppNotification[]> => repo.notifications.listMine();

// --- Doctor earnings (§6.9a) -----------------------------------------
export const getDoctorEarnings = (providerId: string, paidOnly = false): Promise<DoctorEarnings> =>
  repo.bills.earnings(providerId, paidOnly);

// --- Dashboard aggregates (migration 0013) -----------------------------
// Home/Reports fetch these few numbers instead of whole tables.
export const getDashboardKpis = (): Promise<DashboardKpis> => repo.dashboard.kpis(todayRange());

export const getTrendSeries = (unit: 'day' | 'month', count: number): Promise<TrendPoint[]> =>
  repo.dashboard.trends(unit, count, deviceTz());

export const getProviderShares = (): Promise<ProviderShare[]> => repo.dashboard.providerShares();

export const getOutstandingByPatient = (): Promise<OutstandingBalance[]> =>
  repo.dashboard.outstandingByPatient();

export const getDoctorPatientCount = (providerId: string): Promise<number> =>
  repo.dashboard.doctorPatientCount(providerId);
