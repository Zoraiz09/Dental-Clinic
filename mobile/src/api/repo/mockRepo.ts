import dayjs from 'dayjs';
import {
  Appointment, AppointmentType, Bill, EMR, Expense, InventoryItem,
  OutstandingBalance, Patient, Prescription, Profile,
} from '../../types/models';
import {
  earningsFor, mockAppointmentTypes, mockAppointments, mockBills, mockEMR,
  mockExpenses, mockInventory, mockNotifications, mockPatients, mockPrescriptions,
  mockProfiles, mockProviders, mockStockMovements, mockTimeSlots,
} from '../mockData';
import { computeBillTotals, doctorShareFor, effectiveSharePct } from '../../services/billing';
import {
  AppointmentRepo, AuthRepo, BillRepo, ClinicRepo, DashboardRepo, EmrRepo,
  ExpenseRepo, InventoryRepo, NotificationRepo, PatientRepo, PrescriptionRepo,
  ProviderRepo, ServiceRepo, StaffRepo, TimeRange, TimeSlotRepo,
} from './types';

/**
 * In-memory backend used in demo mode (no Supabase credentials). The logic
 * here is lifted verbatim from the former `if (isMock)` branches in
 * queries.ts / mutations.ts / auth.ts so behaviour is identical — it just
 * lives behind the interface now instead of being interleaved with the
 * live code.
 */

let seq = 100;
const nextId = (p: string) => `${p}${seq++}`;

// Tiny in-memory mock session (persisted via SecureStore is overkill for demo).
let mockCurrentUserId: string | null = null;

const auth: AuthRepo = {
  async signIn(identifier, password) {
    // Match by email OR phone; password is accepted as "password" for any demo user.
    const found = mockProfiles.find(
      (p) => p.email === identifier.trim().toLowerCase() || p.phone === identifier.trim(),
    );
    if (!found || (password && password !== found.password && password !== 'password')) {
      throw new Error('Invalid credentials. Try admin@noor.clinic / password');
    }
    if (!found.is_active) throw new Error('This account has been deactivated. Contact your admin.');
    mockCurrentUserId = found.id;
    const { password: _pw, ...profile } = found;
    return profile;
  },

  async signOut() {
    mockCurrentUserId = null;
  },

  async currentProfile() {
    if (!mockCurrentUserId) return null;
    const found = mockProfiles.find((p) => p.id === mockCurrentUserId);
    if (!found) return null;
    const { password: _pw, ...profile } = found;
    return profile;
  },

  async currentUserId() {
    return mockCurrentUserId;
  },

  async sendPasswordReset() {
    // no-op in demo
  },

  async changePassword(currentPassword, newPassword) {
    const user = mockProfiles.find((p) => p.id === mockCurrentUserId);
    if (!user) throw new Error('You are not signed in.');
    if (currentPassword !== (user.password ?? 'password')) {
      throw new Error('Current password is incorrect.');
    }
    user.password = newPassword;
  },
};

const patients: PatientRepo = {
  async list(search) {
    const q = search.trim().toLowerCase();
    return mockPatients.filter(
      (p) => !q || p.full_name.toLowerCase().includes(q) || p.phone.includes(q),
    );
  },

  async get(id) {
    return mockPatients.find((p) => p.id === id) ?? null;
  },

  async create(input) {
    const p: Patient = {
      id: `p${mockPatients.length + 1}`,
      mrn: `NDC-${String(mockPatients.length + 1).padStart(4, '0')}`,
      full_name: input.full_name ?? 'New Patient',
      phone: input.phone ?? '',
      email: input.email ?? null,
      gender: input.gender ?? null,
      date_of_birth: input.date_of_birth ?? null,
      address: input.address ?? null,
      photo_url: input.photo_url ?? null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    mockPatients.unshift(p);
    return p;
  },

  async update(id, input) {
    const p = mockPatients.find((x) => x.id === id);
    if (p) Object.assign(p, input);
    return p!;
  },
};

// True when ISO timestamp `iso` falls inside the half-open window.
const inWindow = (iso: string | null | undefined, range: TimeRange) =>
  !!iso && !dayjs(iso).isBefore(range.from) && dayjs(iso).isBefore(range.to);

const appointments: AppointmentRepo = {
  async list(range) {
    if (!range) return mockAppointments;
    return mockAppointments.filter((a) => inWindow(a.scheduled_for, range));
  },

  async byPatient(patientId) {
    return mockAppointments.filter((a) => a.patient_id === patientId);
  },

  async book(input) {
    if (input.time_slot_id) {
      const slot = mockTimeSlots.find((s) => s.id === input.time_slot_id);
      if (slot) slot.is_available = false;
    }
    const appt: Appointment = {
      id: nextId('a'),
      patient_id: input.patient_id,
      provider_id: input.provider_id,
      appointment_type_id: input.appointment_type_id,
      time_slot_id: input.time_slot_id,
      status: 'BOOKED',
      scheduled_for: input.scheduled_for,
      queue_number: null,
      reason: input.reason ?? null,
      patient: mockPatients.find((p) => p.id === input.patient_id),
      provider: mockProviders.find((p) => p.id === input.provider_id) ?? undefined,
      appointment_type: mockAppointmentTypes.find((t) => t.id === input.appointment_type_id) ?? undefined,
    };
    mockAppointments.unshift(appt);
    return appt;
  },

  async setStatus(id, status) {
    const a = mockAppointments.find((x) => x.id === id);
    if (a) {
      a.status = status;
      if (status === 'CHECKED_IN' && a.queue_number == null) {
        const todays = mockAppointments.filter((x) => x.queue_number != null);
        a.queue_number = todays.length + 1;
      }
    }
  },

  async completeSession(appointmentId) {
    await appointments.completeVisitAndBill(appointmentId);
  },

  async completeVisitAndBill(appointmentId) {
    const appt = mockAppointments.find((a) => a.id === appointmentId);
    if (appt) appt.status = 'COMPLETED';
    let bill = mockBills.find((b) => b.appointment_id === appointmentId);
    if (!bill && appt) {
      const type = mockAppointmentTypes.find((t) => t.id === appt.appointment_type_id);
      const provider = mockProviders.find((p) => p.id === appt.provider_id);
      const consultation = type?.consultation_fee ?? 0;
      const test = type?.test_fee ?? 0;
      // Prefer the doctor's own share %; fall back to the type's default.
      const pct = effectiveSharePct(provider, type);
      bill = await bills.create({
        patient_id: appt.patient_id,
        provider_id: appt.provider_id,
        appointment_id: appointmentId,
        consultation_fee: consultation,
        test_fee: test,
        discount: 0,
        doctor_share: doctorShareFor(consultation, test, pct),
      });
    }
    return bill!;
  },
};

const services: ServiceRepo = {
  async list() {
    return mockAppointmentTypes.filter((t) => t.is_active);
  },

  async create(input) {
    const t: AppointmentType = {
      id: nextId('at'),
      name: input.name,
      specialty: input.specialty,
      duration_minutes: input.duration_minutes ?? 30,
      consultation_fee: input.consultation_fee,
      test_fee: input.test_fee ?? 0,
      default_doctor_pct: input.default_doctor_pct ?? 50,
      is_active: true,
    };
    mockAppointmentTypes.push(t);
    return t;
  },

  async update(id, patch) {
    const t = mockAppointmentTypes.find((x) => x.id === id);
    if (!t) throw new Error('Service not found');
    Object.assign(t, patch);
    return t;
  },

  async deactivate(id) {
    const t = mockAppointmentTypes.find((x) => x.id === id);
    if (t) t.is_active = false;
  },
};

const providers: ProviderRepo = {
  async list() {
    return mockProviders;
  },
};

const timeSlots: TimeSlotRepo = {
  async list(providerId) {
    return mockTimeSlots.filter((s) => !providerId || s.provider_id === providerId);
  },
};

const bills: BillRepo = {
  async list() {
    return mockBills;
  },

  async listOpen() {
    return mockBills.filter((b) => b.status === 'PENDING' || b.status === 'PARTIAL');
  },

  async byPatient(patientId) {
    return mockBills.filter((b) => b.patient_id === patientId);
  },

  async byProvider(providerId) {
    return mockBills.filter((b) => b.provider_id === providerId && b.status !== 'CANCELLED');
  },

  async create(input) {
    const totals = computeBillTotals(input);
    const bill: Bill = {
      id: nextId('b'),
      invoice_no: `INV-${1000 + mockBills.length + 1}`,
      patient_id: input.patient_id,
      appointment_id: input.appointment_id ?? null,
      provider_id: input.provider_id,
      consultation_fee: input.consultation_fee,
      test_fee: input.test_fee,
      discount: input.discount,
      ...totals,
      amount_paid: 0,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      patient: mockPatients.find((p) => p.id === input.patient_id),
    };
    mockBills.unshift(bill);
    return bill;
  },

  async recordPayment(billId, amount) {
    const b = mockBills.find((x) => x.id === billId);
    if (b) {
      b.amount_paid = Math.min(b.total_amount, b.amount_paid + amount);
      b.status = b.amount_paid <= 0 ? 'PENDING' : b.amount_paid < b.total_amount ? 'PARTIAL' : 'PAID';
    }
  },

  async earnings(providerId, paidOnly) {
    return earningsFor(providerId, paidOnly);
  },
};

const emr: EmrRepo = {
  async byPatient(patientId) {
    return mockEMR.filter((e) => e.patient_id === patientId);
  },

  async create(input) {
    const e: EMR = {
      id: nextId('emr'),
      patient_id: input.patient_id,
      appointment_id: input.appointment_id ?? null,
      provider_id: input.provider_id,
      specialty: input.specialty,
      chief_complaint: input.chief_complaint || null,
      diagnosis: input.diagnosis || null,
      treatment_plan: input.treatment_plan || null,
      tooth_chart: input.tooth_chart,
      aesthetic_data: input.aesthetic_data,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    mockEMR.unshift(e);
    return e;
  },
};

const prescriptions: PrescriptionRepo = {
  async byPatient(patientId) {
    return mockPrescriptions.filter((p) => p.patient_id === patientId);
  },

  async dueOn(date, providerId) {
    return mockPrescriptions
      .filter((r) => r.follow_up_date === date && (!providerId || r.provider_id === providerId))
      .map((r) => ({
        ...r,
        patient: { full_name: mockPatients.find((p) => p.id === r.patient_id)?.full_name ?? 'patient' },
      }));
  },

  async create(input) {
    const r: Prescription = {
      id: nextId('rx'),
      patient_id: input.patient_id,
      emr_id: input.emr_id ?? null,
      provider_id: input.provider_id,
      rx_type: input.rx_type,
      items: input.items,
      advice: input.advice ?? null,
      follow_up_date: input.follow_up_date ?? null,
      created_at: new Date().toISOString(),
    };
    mockPrescriptions.unshift(r);
    return r;
  },
};

const inventory: InventoryRepo = {
  async listItems() {
    return mockInventory;
  },

  async listMovements() {
    return mockStockMovements.map((m) => ({
      ...m,
      unit_cost: mockInventory.find((i) => i.id === m.item_id)?.unit_cost ?? 0,
    }));
  },

  async createItem(input) {
    const item: InventoryItem = {
      id: nextId('i'),
      name: input.name ?? 'New item',
      sku: input.sku ?? null,
      unit: input.unit ?? 'unit',
      quantity: 0,
      reorder_level: input.reorder_level ?? 0,
      unit_cost: input.unit_cost ?? 0,
      is_active: true,
    };
    mockInventory.unshift(item);
    return item;
  },

  async adjustStock(itemId, type, quantity) {
    const i = mockInventory.find((x) => x.id === itemId);
    if (i) i.quantity = type === 'ADD' ? i.quantity + quantity : type === 'DEDUCT' ? i.quantity - quantity : quantity;
    mockStockMovements.unshift({ id: nextId('sm'), item_id: itemId, type, quantity, created_at: new Date().toISOString() });
  },
};

const expenses: ExpenseRepo = {
  async list() {
    return mockExpenses.map((e) => {
      const p = e.created_by ? mockProfiles.find((x) => x.id === e.created_by) : undefined;
      return { ...e, creator: p ? { full_name: p.full_name } : null };
    });
  },

  async create(input, createdBy) {
    const e: Expense = {
      id: nextId('e'),
      category: input.category ?? null,
      description: input.description ?? '',
      amount: input.amount ?? 0,
      receipt_url: input.receipt_url ?? null,
      spent_at: input.spent_at ?? new Date().toISOString().slice(0, 10),
      created_at: input.created_at ?? new Date().toISOString(),
      created_by: createdBy,
    };
    mockExpenses.unshift(e);
    return e;
  },
};

const staff: StaffRepo = {
  async list() {
    return mockProfiles.map(({ password: _pw, ...p }) => p);
  },

  async create(input) {
    const p = {
      id: nextId('u'), full_name: input.full_name, email: input.email.toLowerCase(),
      phone: input.phone ?? null, role: input.role, avatar_url: input.avatar_url ?? null, is_active: true, password: input.password,
    };
    mockProfiles.push(p);
    if (input.role === 'DOCTOR') {
      mockProviders.push({
        id: nextId('pv'), profile_id: p.id, full_name: input.full_name,
        title: input.title ?? (input.employment_type === 'VISITING' ? 'Visiting Doctor' : 'In-house Doctor'),
        specialty: input.specialty ?? null, is_primary: false, avatar_url: input.avatar_url ?? null, is_active: true,
        employment_type: input.employment_type ?? 'IN_HOUSE', default_share_pct: input.share_pct ?? 0,
      });
    }
    const { password: _pw, ...profile } = p;
    return profile;
  },

  async updateProfile(userId, patch) {
    const p = mockProfiles.find((x) => x.id === userId);
    if (!p) throw new Error('Profile not found.');
    Object.assign(p, patch);
    mockProviders.forEach((pv) => {
      if (pv.profile_id === userId) {
        if (patch.full_name !== undefined) pv.full_name = patch.full_name;
        if (patch.avatar_url !== undefined) pv.avatar_url = patch.avatar_url;
      }
    });
    const { password: _pw, ...profile } = p;
    return profile;
  },

  async setActive(profileId, active) {
    const p = mockProfiles.find((x) => x.id === profileId);
    if (p) p.is_active = active;
    mockProviders.forEach((pv) => { if (pv.profile_id === profileId) pv.is_active = active; });
  },

  async remove(profileId) {
    const i = mockProfiles.findIndex((x) => x.id === profileId);
    if (i >= 0) mockProfiles.splice(i, 1);
    for (let j = mockProviders.length - 1; j >= 0; j--) {
      if (mockProviders[j].profile_id === profileId) mockProviders.splice(j, 1);
    }
  },
};

// Mirrors the SQL aggregates in migration 0013 over the in-memory arrays —
// the same numbers the dashboards used to compute from whole-table fetches.
const dashboard: DashboardRepo = {
  async kpis(range) {
    const active = mockBills.filter((b) => b.status !== 'CANCELLED');
    const todayMoves = mockStockMovements
      .filter((m) => inWindow(m.created_at, range) && m.type !== 'ADJUST')
      .map((m) => ({ ...m, unit_cost: mockInventory.find((i) => i.id === m.item_id)?.unit_cost ?? 0 }));
    const cost = (ms: typeof todayMoves) => ms.reduce((s, m) => s + m.quantity * m.unit_cost, 0);
    return {
      revenue_today: active.filter((b) => inWindow(b.created_at, range)).reduce((s, b) => s + b.total_amount, 0),
      items_purchased_today: cost(todayMoves.filter((m) => m.type === 'ADD')),
      items_used_today: cost(todayMoves.filter((m) => m.type === 'DEDUCT')),
      appts_today: mockAppointments.filter((a) => inWindow(a.scheduled_for, range) && a.status !== 'CANCELLED').length,
      checked_in: mockAppointments.filter((a) => a.status === 'CHECKED_IN').length,
      pending_bills: mockBills.filter((b) => b.status === 'PENDING' || b.status === 'PARTIAL').length,
      low_stock: mockInventory.filter((i) => i.quantity <= i.reorder_level).length,
      new_patients_today: mockPatients.filter((p) => inWindow(p.created_at, range)).length,
      total_patients: mockPatients.length,
      outstanding: active.reduce((s, b) => s + (b.total_amount - b.amount_paid), 0),
      expenses_total: mockExpenses.reduce((s, e) => s + e.amount, 0),
      week_revenue: active
        .filter((b) => dayjs(b.created_at).isAfter(dayjs(range.to).subtract(7, 'day')) && dayjs(b.created_at).isBefore(range.to))
        .reduce((s, b) => s + b.total_amount, 0),
    };
  },

  async trends(unit, count) {
    const now = dayjs();
    const buckets = Array.from({ length: count }, (_, i) => now.subtract(count - 1 - i, unit).startOf(unit));
    const active = mockBills.filter((b) => b.status !== 'CANCELLED');
    return buckets.map((d) => ({
      bucket: d.format('YYYY-MM-DD'),
      revenue: active.filter((b) => dayjs(b.created_at).isSame(d, unit)).reduce((s, b) => s + b.total_amount, 0),
      patients_seen: mockAppointments.filter((a) => a.status === 'COMPLETED' && dayjs(a.scheduled_for).isSame(d, unit)).length,
      expenses: mockExpenses.filter((e) => dayjs(e.spent_at).isSame(d, unit)).reduce((s, e) => s + e.amount, 0),
    }));
  },

  async providerShares() {
    return mockProviders
      .map((p) => ({
        provider_id: p.id,
        full_name: p.full_name,
        title: p.title,
        share: mockBills
          .filter((b) => b.provider_id === p.id && b.status !== 'CANCELLED')
          .reduce((s, b) => s + b.doctor_share, 0),
      }))
      .filter((x) => x.share > 0)
      .sort((a, b) => b.share - a.share);
  },

  async outstandingByPatient() {
    const map = new Map<string, OutstandingBalance>();
    mockBills.filter((b) => b.status !== 'CANCELLED').forEach((b) => {
      const due = b.total_amount - b.amount_paid;
      if (due <= 0) return;
      const name = b.patient?.full_name
        ?? mockPatients.find((p) => p.id === b.patient_id)?.full_name ?? 'Patient';
      const prev = map.get(b.patient_id);
      map.set(b.patient_id, { patient_id: b.patient_id, full_name: name, due: (prev?.due ?? 0) + due });
    });
    return [...map.values()].sort((a, b) => b.due - a.due);
  },

  async doctorPatientCount(providerId) {
    return new Set(mockAppointments.filter((a) => a.provider_id === providerId).map((a) => a.patient_id)).size;
  },
};

const notifications: NotificationRepo = {
  async listMine() {
    return [...mockNotifications];
  },

  async markRead(id) {
    const n = mockNotifications.find((x) => x.id === id);
    if (n && !n.read_at) n.read_at = new Date().toISOString();
  },

  async markAllRead() {
    mockNotifications.forEach((n) => { if (!n.read_at) n.read_at = new Date().toISOString(); });
  },
};

export const mockRepo: ClinicRepo = {
  auth, patients, appointments, services, providers, timeSlots,
  bills, emr, prescriptions, inventory, expenses, staff, notifications, dashboard,
};
