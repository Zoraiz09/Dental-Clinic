import { supabase, isMock, createAuthOnlyClient } from '../lib/supabase';
import {
  Appointment, AppointmentType, Bill, EMR, EmploymentType, Expense, InventoryItem, Prescription, PrescriptionType,
  Profile, RxItem, Specialty, StockMovementType, ToothChart, UserRole,
} from '../types/models';
import {
  mockAppointments, mockBills, mockEMR, mockExpenses, mockInventory, mockPatients,
  mockPrescriptions, mockProfiles, mockProviders, mockAppointmentTypes, mockStockMovements, mockTimeSlots,
} from './mockData';

let seq = 100;
const nextId = (p: string) => `${p}${seq++}`;

// --- Appointments -----------------------------------------------------
export interface BookInput {
  patient_id: string;
  provider_id: string | null;
  appointment_type_id: string | null;
  time_slot_id: string | null;
  scheduled_for: string;
  reason?: string;
}

export async function bookAppointment(input: BookInput): Promise<Appointment> {
  if (isMock) {
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
  }
  const { data, error } = await supabase.from('appointments').insert({
    patient_id: input.patient_id,
    provider_id: input.provider_id,
    appointment_type_id: input.appointment_type_id,
    time_slot_id: input.time_slot_id,
    scheduled_for: input.scheduled_for,
    reason: input.reason,
  }).select('*, patient:patients(*), provider:providers(*), appointment_type:appointment_types(*)').single();
  if (error) throw error;
  if (input.time_slot_id) {
    await supabase.from('time_slots').update({ is_available: false }).eq('id', input.time_slot_id);
  }
  return data as Appointment;
}

export async function setAppointmentStatus(id: string, status: Appointment['status']): Promise<void> {
  if (isMock) {
    const a = mockAppointments.find((x) => x.id === id);
    if (a) {
      a.status = status;
      if (status === 'CHECKED_IN' && a.queue_number == null) {
        const todays = mockAppointments.filter((x) => x.queue_number != null);
        a.queue_number = todays.length + 1;
      }
    }
    return;
  }
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) throw error;
}

export const cancelAppointment = (id: string) => setAppointmentStatus(id, 'CANCELLED');
export const checkInAppointment = (id: string) => setAppointmentStatus(id, 'CHECKED_IN');
export const completeAppointment = (id: string) => setAppointmentStatus(id, 'COMPLETED');

/**
 * A doctor completes their own session: marks it COMPLETED and generates
 * the bill. Uses the complete_session DB function (migration 0009) so the
 * doctor's role can finalize + bill in one step.
 */
export async function completeSession(appointmentId: string): Promise<void> {
  if (isMock) {
    await completeVisitAndBill(appointmentId);
    return;
  }
  const { error } = await supabase.rpc('complete_session', { p_appt: appointmentId });
  if (error) throw error;
}

/**
 * Complete a visit AND ensure a bill exists for it (fixes "billing not
 * generated on completion"). Fees + doctor share are derived from the
 * appointment type. Returns the bill so the UI can collect payment.
 */
export async function completeVisitAndBill(appointmentId: string): Promise<Bill> {
  if (isMock) {
    const appt = mockAppointments.find((a) => a.id === appointmentId);
    if (appt) appt.status = 'COMPLETED';
    let bill = mockBills.find((b) => b.appointment_id === appointmentId);
    if (!bill && appt) {
      const type = mockAppointmentTypes.find((t) => t.id === appt.appointment_type_id);
      const provider = mockProviders.find((p) => p.id === appt.provider_id);
      const consultation = type?.consultation_fee ?? 0;
      const test = type?.test_fee ?? 0;
      // Prefer the doctor's own share %; fall back to the type's default.
      const pct = provider?.default_share_pct || type?.default_doctor_pct || 0;
      const total = consultation + test;
      bill = await createBill({
        patient_id: appt.patient_id,
        provider_id: appt.provider_id,
        appointment_id: appointmentId,
        consultation_fee: consultation,
        test_fee: test,
        discount: 0,
        doctor_share: Math.round((total * pct) / 100),
      });
    }
    return bill!;
  }

  await supabase.from('appointments').update({ status: 'COMPLETED' }).eq('id', appointmentId);
  const { data: existing } = await supabase.from('bills').select('*, patient:patients(*)').eq('appointment_id', appointmentId).maybeSingle();
  if (existing) return existing as Bill;

  const { data: appt } = await supabase
    .from('appointments')
    .select('*, appointment_type:appointment_types(*), provider:providers(*)')
    .eq('id', appointmentId).single();
  const type = (appt as any)?.appointment_type;
  const provider = (appt as any)?.provider;
  const total = (type?.consultation_fee ?? 0) + (type?.test_fee ?? 0);
  const pct = provider?.default_share_pct || type?.default_doctor_pct || 0;
  return createBill({
    patient_id: appt!.patient_id,
    provider_id: appt!.provider_id,
    appointment_id: appointmentId,
    consultation_fee: type?.consultation_fee ?? 0,
    test_fee: type?.test_fee ?? 0,
    discount: 0,
    doctor_share: Math.round((total * pct) / 100),
  });
}

// --- Billing ----------------------------------------------------------
export interface BillInput {
  patient_id: string;
  provider_id: string | null;
  appointment_id?: string | null;
  consultation_fee: number;
  test_fee: number;
  discount: number;
  doctor_share: number;
}

export async function createBill(input: BillInput): Promise<Bill> {
  if (isMock) {
    const total = input.consultation_fee + input.test_fee - input.discount;
    const bill: Bill = {
      id: nextId('b'),
      invoice_no: `INV-${1000 + mockBills.length + 1}`,
      patient_id: input.patient_id,
      appointment_id: input.appointment_id ?? null,
      provider_id: input.provider_id,
      consultation_fee: input.consultation_fee,
      test_fee: input.test_fee,
      discount: input.discount,
      total_amount: total,
      doctor_share: Math.min(input.doctor_share, total),
      clinic_share: total - Math.min(input.doctor_share, total),
      amount_paid: 0,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      patient: mockPatients.find((p) => p.id === input.patient_id),
    };
    mockBills.unshift(bill);
    return bill;
  }
  const { data, error } = await supabase.from('bills').insert(input).select('*, patient:patients(*)').single();
  if (error) throw error;
  return data as Bill;
}

// --- EMR --------------------------------------------------------------
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

export async function createEMR(input: EMRInput): Promise<EMR> {
  if (isMock) {
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
  }
  const { data, error } = await supabase.from('emr').insert(input).select().single();
  if (error) throw error;
  return data as EMR;
}

// --- Prescriptions ----------------------------------------------------
export interface RxInput {
  patient_id: string;
  provider_id: string | null;
  emr_id?: string | null;
  rx_type: PrescriptionType;
  items: RxItem[];
  advice?: string;
  follow_up_date?: string | null;
}

export async function createPrescription(input: RxInput): Promise<Prescription> {
  if (isMock) {
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
  }
  const { data, error } = await supabase.from('prescriptions').insert(input).select().single();
  if (error) throw error;
  return data as Prescription;
}

export async function recordPayment(billId: string, amount: number, method = 'cash'): Promise<void> {
  if (isMock) {
    const b = mockBills.find((x) => x.id === billId);
    if (b) {
      b.amount_paid = Math.min(b.total_amount, b.amount_paid + amount);
      b.status = b.amount_paid <= 0 ? 'PENDING' : b.amount_paid < b.total_amount ? 'PARTIAL' : 'PAID';
    }
    return;
  }
  const { error } = await supabase.from('bill_payments').insert({ bill_id: billId, amount, method });
  if (error) throw error;
}

// --- Inventory (admin) ------------------------------------------------
export async function createInventoryItem(input: Partial<InventoryItem>): Promise<InventoryItem> {
  const initialQty = input.quantity ?? 0;
  const unitCost = input.unit_cost ?? 0;
  let item: InventoryItem;
  if (isMock) {
    item = {
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
    if (initialQty > 0) await adjustStock(item.id, 'ADD', initialQty, 'Initial stock');
  } else {
    // Insert at 0, then book the opening stock as an ADD movement so the
    // purchase cost is recorded (the DB trigger raises quantity to initialQty).
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ ...input, quantity: 0 })
      .select().single();
    if (error) throw error;
    item = data as InventoryItem;
    if (initialQty > 0) await adjustStock(item.id, 'ADD', initialQty, 'Initial stock');
  }

  // Record the opening purchase in the expense ledger.
  if (initialQty > 0 && unitCost > 0) {
    await createExpense({
      category: 'Inventory',
      description: `Inventory: ${item.name} (${initialQty} ${item.unit} @ ${unitCost})`,
      amount: initialQty * unitCost,
    });
  }
  return item;
}

export async function adjustStock(itemId: string, type: StockMovementType, quantity: number, reason?: string): Promise<void> {
  if (isMock) {
    const i = mockInventory.find((x) => x.id === itemId);
    if (i) i.quantity = type === 'ADD' ? i.quantity + quantity : type === 'DEDUCT' ? i.quantity - quantity : quantity;
    mockStockMovements.unshift({ id: nextId('sm'), item_id: itemId, type, quantity, created_at: new Date().toISOString() });
    return;
  }
  // The DB trigger applies the quantity change from the movement row.
  const { error } = await supabase.from('stock_movements').insert({ item_id: itemId, type, quantity, reason });
  if (error) throw error;
}

// --- Expenses ---------------------------------------------------------
export async function createExpense(input: Partial<Expense>): Promise<Expense> {
  if (isMock) {
    const e: Expense = {
      id: nextId('e'),
      category: input.category ?? null,
      description: input.description ?? '',
      amount: input.amount ?? 0,
      receipt_url: input.receipt_url ?? null,
      spent_at: input.spent_at ?? new Date().toISOString().slice(0, 10),
      created_at: input.created_at ?? new Date().toISOString(),
    };
    mockExpenses.unshift(e);
    return e;
  }
  const { data, error } = await supabase.from('expenses').insert(input).select().single();
  if (error) throw error;
  return data as Expense;
}

// --- Appointment types / services & prices (admin + receptionist) ------
export interface AppointmentTypeInput {
  name: string;
  specialty: Specialty | null;
  consultation_fee: number;
  test_fee?: number;
  duration_minutes?: number;
  default_doctor_pct?: number;
}

export async function createAppointmentType(input: AppointmentTypeInput): Promise<AppointmentType> {
  if (isMock) {
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
  }
  const { data, error } = await supabase.from('appointment_types').insert({
    name: input.name,
    specialty: input.specialty,
    duration_minutes: input.duration_minutes ?? 30,
    consultation_fee: input.consultation_fee,
    test_fee: input.test_fee ?? 0,
    default_doctor_pct: input.default_doctor_pct ?? 50,
  }).select().single();
  if (error) throw error;
  return data as AppointmentType;
}

export async function updateAppointmentType(id: string, patch: Partial<AppointmentTypeInput>): Promise<AppointmentType> {
  if (isMock) {
    const t = mockAppointmentTypes.find((x) => x.id === id);
    if (!t) throw new Error('Service not found');
    Object.assign(t, patch);
    return t;
  }
  const { data, error } = await supabase.from('appointment_types').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as AppointmentType;
}

// Soft-delete: hide the service from the catalog while keeping past
// appointments/bills that referenced it intact (FK is ON DELETE SET NULL).
export async function deleteAppointmentType(id: string): Promise<void> {
  if (isMock) {
    const t = mockAppointmentTypes.find((x) => x.id === id);
    if (t) t.is_active = false;
    return;
  }
  const { error } = await supabase.from('appointment_types').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// --- Staff (admin) ----------------------------------------------------
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

export async function createStaff(input: StaffInput): Promise<Profile> {
  if (isMock) {
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
  }

  // Live: create the auth user on a throwaway client so the admin's own
  // session stays put. The handle_new_user trigger makes the profile;
  // then we (as admin) set the role and, for doctors, the provider row.
  const authClient = createAuthOnlyClient();
  const { data, error } = await authClient.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { full_name: input.full_name, phone: input.phone, role: input.role } },
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('Could not create the account.');

  // Ensure the profile reflects the chosen role/name (admin RLS permits).
  await supabase.from('profiles').update({
    role: input.role, full_name: input.full_name, phone: input.phone ?? null,
    avatar_url: input.avatar_url ?? null,
  }).eq('id', userId);

  if (input.role === 'DOCTOR') {
    await supabase.from('providers').insert({
      profile_id: userId,
      full_name: input.full_name,
      title: input.title ?? (input.employment_type === 'VISITING' ? 'Visiting Doctor' : 'In-house Doctor'),
      specialty: input.specialty ?? null,
      employment_type: input.employment_type ?? 'IN_HOUSE',
      default_share_pct: input.share_pct ?? 0,
      is_primary: false,
      avatar_url: input.avatar_url ?? null,
    });
  }

  return {
    id: userId, full_name: input.full_name, email: input.email.toLowerCase(),
    phone: input.phone ?? null, role: input.role, avatar_url: input.avatar_url ?? null, is_active: true,
  };
}

/**
 * Update the signed-in user's own profile (any role). Edits name/phone/photo;
 * email & role are intentionally not changeable here. For doctors, the linked
 * provider row is kept in sync so the booking directory shows the new name/photo.
 */
export interface ProfileUpdate {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
}

export async function updateMyProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  if (isMock) {
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
  }

  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
  if (error) throw error;

  // Keep the doctor's provider row in sync (no-op for non-doctors).
  const provPatch: Partial<{ full_name: string; avatar_url: string | null }> = {};
  if (patch.full_name !== undefined) provPatch.full_name = patch.full_name;
  if (patch.avatar_url !== undefined) provPatch.avatar_url = patch.avatar_url;
  if (Object.keys(provPatch).length) {
    await supabase.from('providers').update(provPatch).eq('profile_id', userId);
  }
  return data as Profile;
}

/** Enable/disable a staff member's access (reversible). */
export async function setStaffActive(profileId: string, active: boolean): Promise<void> {
  if (isMock) {
    const p = mockProfiles.find((x) => x.id === profileId);
    if (p) p.is_active = active;
    mockProviders.forEach((pv) => { if (pv.profile_id === profileId) pv.is_active = active; });
    return;
  }
  const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', profileId);
  if (error) throw error;
  // Keep them out of (or back into) the bookable doctor directory.
  await supabase.from('providers').update({ is_active: active }).eq('profile_id', profileId);
}

/** Permanently delete a staff account (login + provider). Needs migration 0008. */
export async function deleteStaff(profileId: string): Promise<void> {
  if (isMock) {
    const i = mockProfiles.findIndex((x) => x.id === profileId);
    if (i >= 0) mockProfiles.splice(i, 1);
    for (let j = mockProviders.length - 1; j >= 0; j--) {
      if (mockProviders[j].profile_id === profileId) mockProviders.splice(j, 1);
    }
    return;
  }
  const { error } = await supabase.rpc('delete_staff', { target: profileId });
  if (error) throw error;
}
