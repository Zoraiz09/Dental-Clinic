import {
  Appointment, AppointmentType, AppNotification, Bill, DashboardKpis,
  DoctorEarnings, EMR, EmploymentType, Expense, InventoryItem, OutstandingBalance,
  Patient, Prescription, PrescriptionType, Profile, Provider, ProviderShare,
  RxItem, Specialty, StockMovement, StockMovementType, TimeSlot, ToothChart,
  TrendPoint, UserRole,
} from '../../types/models';

/**
 * Repository interfaces — the contract every data backend must satisfy.
 *
 * This is the seam that replaces the per-function `if (isMock) … else …`
 * branching that used to live in queries.ts / mutations.ts. Each backend
 * (mock, Supabase) implements these once; the app picks one at startup
 * (see ./index) and never branches on mock-vs-live again.
 */

// --- Input shapes (shared by both backends and re-exported by the api facades)

export interface BookInput {
  patient_id: string;
  provider_id: string | null;
  appointment_type_id: string | null;
  time_slot_id: string | null;
  scheduled_for: string;
  reason?: string;
}

export interface BillInput {
  patient_id: string;
  provider_id: string | null;
  appointment_id?: string | null;
  consultation_fee: number;
  test_fee: number;
  discount: number;
  doctor_share: number;
}

export interface EMRInput {
  patient_id: string;
  provider_id: string | null;
  appointment_id?: string | null;
  specialty: Specialty;
  chief_complaint: string;
  diagnosis: string;
  treatment_plan: string;
  tooth_chart: ToothChart;
  aesthetic_data: Record<string, unknown>;
  notes?: string;
}

export interface RxInput {
  patient_id: string;
  provider_id: string | null;
  emr_id?: string | null;
  rx_type: PrescriptionType;
  items: RxItem[];
  advice?: string;
  follow_up_date?: string | null;
}

export interface AppointmentTypeInput {
  name: string;
  specialty: Specialty | null;
  consultation_fee: number;
  test_fee?: number;
  duration_minutes?: number;
  default_doctor_pct?: number;
}

export interface StaffInput {
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  password: string;
  avatar_url?: string | null;         // optional staff photo
  // Doctor-only:
  specialty?: Specialty | null;
  employment_type?: EmploymentType;   // IN_HOUSE | VISITING
  share_pct?: number;                 // admin-set revenue share %
  title?: string;
}

export interface ProfileUpdate {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

// --- Domain repositories ----------------------------------------------

export interface PatientRepo {
  list(search: string): Promise<Patient[]>;
  get(id: string): Promise<Patient | null>;
  create(input: Partial<Patient>): Promise<Patient>;
  update(id: string, input: Partial<Patient>): Promise<Patient>;
}

/** Half-open ISO time window [from, to) for date-ranged list queries. */
export interface TimeRange {
  from: string;
  to: string;
}

export interface AppointmentRepo {
  /** All appointments, or only those scheduled inside `range`. Dashboards
   *  pass today's window so they stop downloading the whole history. */
  list(range?: TimeRange): Promise<Appointment[]>;
  byPatient(patientId: string): Promise<Appointment[]>;
  book(input: BookInput): Promise<Appointment>;
  setStatus(id: string, status: Appointment['status']): Promise<void>;
  /** Doctor finalizes + bills in one step (complete_session RPC in live). */
  completeSession(appointmentId: string): Promise<void>;
  /** Mark COMPLETED and ensure a bill exists; returns the bill for payment. */
  completeVisitAndBill(appointmentId: string): Promise<Bill>;
}

/** Appointment types — the service/price catalog. */
export interface ServiceRepo {
  list(): Promise<AppointmentType[]>;
  create(input: AppointmentTypeInput): Promise<AppointmentType>;
  update(id: string, patch: Partial<AppointmentTypeInput>): Promise<AppointmentType>;
  /** Soft-delete: hide from the catalog, keep historical references intact. */
  deactivate(id: string): Promise<void>;
}

export interface ProviderRepo {
  list(): Promise<Provider[]>;
}

export interface TimeSlotRepo {
  list(providerId?: string): Promise<TimeSlot[]>;
}

export interface BillRepo {
  list(): Promise<Bill[]>;
  /** Only PENDING/PARTIAL bills — the small working set the front desk
   *  needs (due payments, overdue alerts) without the full billing history. */
  listOpen(): Promise<Bill[]>;
  byPatient(patientId: string): Promise<Bill[]>;
  byProvider(providerId: string): Promise<Bill[]>;
  create(input: BillInput): Promise<Bill>;
  recordPayment(billId: string, amount: number, method: string): Promise<void>;
  earnings(providerId: string, paidOnly: boolean): Promise<DoctorEarnings>;
}

export interface EmrRepo {
  byPatient(patientId: string): Promise<EMR[]>;
  create(input: EMRInput): Promise<EMR>;
}

export interface PrescriptionRepo {
  byPatient(patientId: string): Promise<Prescription[]>;
  /** Prescriptions whose follow-up lands on `date` (YYYY-MM-DD), optionally
   *  for one provider. The caller supplies the date so "today" is computed
   *  in one place (the facade), not per backend. */
  dueOn(date: string, providerId?: string): Promise<Prescription[]>;
  create(input: RxInput): Promise<Prescription>;
}

export interface InventoryRepo {
  listItems(): Promise<InventoryItem[]>;
  listMovements(): Promise<StockMovement[]>;
  /** Raw item insert at quantity 0 — opening stock is booked separately as
   *  an ADD movement (see the createInventoryItem facade orchestration). */
  createItem(input: Partial<InventoryItem>): Promise<InventoryItem>;
  adjustStock(itemId: string, type: StockMovementType, quantity: number, reason?: string): Promise<void>;
}

export interface ExpenseRepo {
  list(): Promise<Expense[]>;
  create(input: Partial<Expense>, createdBy: string | null): Promise<Expense>;
}

export interface StaffRepo {
  list(): Promise<Profile[]>;
  create(input: StaffInput): Promise<Profile>;
  updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile>;
  setActive(profileId: string, active: boolean): Promise<void>;
  remove(profileId: string): Promise<void>;
}

export interface NotificationRepo {
  listMine(): Promise<AppNotification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

/**
 * Read-side aggregates for Home/Reports (migration 0013 RPCs in live).
 * The dashboards fetch these few numbers instead of whole tables.
 */
export interface DashboardRepo {
  /** KPI snapshot for the [from, to) "today" window. */
  kpis(range: TimeRange): Promise<DashboardKpis>;
  /** Trend buckets ending at the current day/month, oldest → newest.
   *  `tz` is the device timezone so bucket boundaries match the UI. */
  trends(unit: 'day' | 'month', count: number, tz: string): Promise<TrendPoint[]>;
  providerShares(): Promise<ProviderShare[]>;
  outstandingByPatient(): Promise<OutstandingBalance[]>;
  /** Distinct patients this doctor has ever seen (doctor-home KPI). */
  doctorPatientCount(providerId: string): Promise<number>;
}

export interface AuthRepo {
  signIn(identifier: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  currentProfile(): Promise<Profile | null>;
  currentUserId(): Promise<string | null>;
  sendPasswordReset(email: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

/** The aggregate backend — one property per domain. */
export interface ClinicRepo {
  auth: AuthRepo;
  patients: PatientRepo;
  appointments: AppointmentRepo;
  services: ServiceRepo;
  providers: ProviderRepo;
  timeSlots: TimeSlotRepo;
  bills: BillRepo;
  emr: EmrRepo;
  prescriptions: PrescriptionRepo;
  inventory: InventoryRepo;
  expenses: ExpenseRepo;
  staff: StaffRepo;
  notifications: NotificationRepo;
  dashboard: DashboardRepo;
}
