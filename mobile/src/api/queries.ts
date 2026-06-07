import { supabase, isMock } from '../lib/supabase';
import {
  Appointment, AppointmentType, Bill, DoctorEarnings, InventoryItem,
  Patient, Provider, TimeSlot, Expense,
} from '../types/models';
import { EMR, Prescription, Profile, StockMovement } from '../types/models';
import {
  earningsFor, mockAppointmentTypes, mockAppointments, mockBills, mockEMR,
  mockExpenses, mockInventory, mockPatients, mockPrescriptions, mockProfiles,
  mockProviders, mockStockMovements, mockTimeSlots,
} from './mockData';

// --- Patients ---------------------------------------------------------
export async function listPatients(search = ''): Promise<Patient[]> {
  if (isMock) {
    const q = search.trim().toLowerCase();
    return mockPatients.filter(
      (p) => !q || p.full_name.toLowerCase().includes(q) || p.phone.includes(q),
    );
  }
  let query = supabase.from('patients').select('*').order('created_at', { ascending: false });
  if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as Patient[];
}

export async function getPatient(id: string): Promise<Patient | null> {
  if (isMock) return mockPatients.find((p) => p.id === id) ?? null;
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Patient;
}

export async function createPatient(input: Partial<Patient>): Promise<Patient> {
  if (isMock) {
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
  }
  const { data, error } = await supabase.from('patients').insert(input).select().single();
  if (error) throw error;
  return data as Patient;
}

export async function updatePatient(id: string, input: Partial<Patient>): Promise<Patient> {
  if (isMock) {
    const p = mockPatients.find((x) => x.id === id);
    if (p) Object.assign(p, input);
    return p!;
  }
  const { data, error } = await supabase.from('patients').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Patient;
}

// --- Per-patient history (drives the Patient Detail tabs) -------------
export async function appointmentsByPatient(patientId: string): Promise<Appointment[]> {
  if (isMock) return mockAppointments.filter((a) => a.patient_id === patientId);
  const { data, error } = await supabase
    .from('appointments')
    .select('*, provider:providers(*), appointment_type:appointment_types(*)')
    .eq('patient_id', patientId)
    .order('scheduled_for', { ascending: false });
  if (error) throw error;
  return data as Appointment[];
}

export async function emrByPatient(patientId: string): Promise<EMR[]> {
  if (isMock) return mockEMR.filter((e) => e.patient_id === patientId);
  const { data, error } = await supabase
    .from('emr').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as EMR[];
}

export async function prescriptionsByPatient(patientId: string): Promise<Prescription[]> {
  if (isMock) return mockPrescriptions.filter((p) => p.patient_id === patientId);
  const { data, error } = await supabase
    .from('prescriptions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Prescription[];
}

export async function billsByPatient(patientId: string): Promise<Bill[]> {
  if (isMock) return mockBills.filter((b) => b.patient_id === patientId);
  const { data, error } = await supabase
    .from('bills').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Bill[];
}

// --- Appointments -----------------------------------------------------
export async function listAppointments(): Promise<Appointment[]> {
  if (isMock) return mockAppointments;
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patient:patients(*), provider:providers(*), appointment_type:appointment_types(*)')
    .order('scheduled_for', { ascending: true });
  if (error) throw error;
  return data as Appointment[];
}

export async function listAppointmentTypes(): Promise<AppointmentType[]> {
  if (isMock) return mockAppointmentTypes;
  const { data, error } = await supabase.from('appointment_types').select('*').eq('is_active', true);
  if (error) throw error;
  return data as AppointmentType[];
}

export async function listProviders(): Promise<Provider[]> {
  if (isMock) return mockProviders;
  const { data, error } = await supabase.from('providers').select('*').eq('is_active', true);
  if (error) throw error;
  return data as Provider[];
}

export async function listTimeSlots(providerId?: string): Promise<TimeSlot[]> {
  if (isMock) return mockTimeSlots.filter((s) => !providerId || s.provider_id === providerId);
  let q = supabase.from('time_slots').select('*').order('starts_at');
  if (providerId) q = q.eq('provider_id', providerId);
  const { data, error } = await q;
  if (error) throw error;
  return data as TimeSlot[];
}

// --- Billing ----------------------------------------------------------
export async function listBills(): Promise<Bill[]> {
  if (isMock) return mockBills;
  const { data, error } = await supabase
    .from('bills')
    .select('*, patient:patients(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Bill[];
}

export async function billsByProvider(providerId: string): Promise<Bill[]> {
  if (isMock) return mockBills.filter((b) => b.provider_id === providerId && b.status !== 'CANCELLED');
  // In live mode RLS already restricts a doctor to their own bills.
  const { data, error } = await supabase
    .from('bills').select('*, patient:patients(*)')
    .eq('provider_id', providerId).neq('status', 'CANCELLED')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Bill[];
}

// --- Inventory --------------------------------------------------------
export async function listInventory(): Promise<InventoryItem[]> {
  if (isMock) return mockInventory;
  const { data, error } = await supabase.from('inventory_items').select('*').eq('is_active', true);
  if (error) throw error;
  return data as InventoryItem[];
}

// --- Staff (admin) ----------------------------------------------------
export async function listStaff(): Promise<Profile[]> {
  if (isMock) return mockProfiles.map(({ password: _pw, ...p }) => p);
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data as Profile[];
}

// --- Stock movements (for inventory cost vs revenue) ------------------
export async function listStockMovements(): Promise<StockMovement[]> {
  if (isMock) {
    return mockStockMovements.map((m) => ({
      ...m,
      unit_cost: mockInventory.find((i) => i.id === m.item_id)?.unit_cost ?? 0,
    }));
  }
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, item_id, type, quantity, created_at, item:inventory_items(unit_cost)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map((m) => ({
    id: m.id, item_id: m.item_id, type: m.type, quantity: m.quantity,
    created_at: m.created_at, unit_cost: m.item?.unit_cost ?? 0,
  }));
}

// --- Expenses ---------------------------------------------------------
export async function listExpenses(): Promise<Expense[]> {
  if (isMock) return mockExpenses;
  const { data, error } = await supabase.from('expenses').select('*').order('spent_at', { ascending: false });
  if (error) throw error;
  return data as Expense[];
}

// --- Doctor earnings (§6.9a) -----------------------------------------
export async function getDoctorEarnings(
  providerId: string,
  paidOnly = false,
): Promise<DoctorEarnings> {
  if (isMock) return earningsFor(providerId, paidOnly);
  const { data, error } = await supabase.rpc('get_doctor_earnings', {
    p_provider_id: providerId,
    p_paid_only: paidOnly,
  });
  if (error) throw error;
  const row = (data as DoctorEarnings[])?.[0];
  return row ?? { provider_id: providerId, total_share: 0, paid_share: 0, pending_share: 0, bill_count: 0 };
}
