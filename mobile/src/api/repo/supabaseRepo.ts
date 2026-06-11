import {
  Appointment, AppointmentType, AppNotification, Bill, DashboardKpis,
  DoctorEarnings, EMR, Expense, InventoryItem, OutstandingBalance, Patient,
  Prescription, Profile, Provider, ProviderShare, StockMovement, TimeSlot, TrendPoint,
} from '../../types/models';
import { supabase, createAuthOnlyClient } from '../../lib/supabase';
import { doctorShareFor, effectiveSharePct } from '../../services/billing';
import {
  AppointmentRepo, AuthRepo, BillRepo, ClinicRepo, DashboardRepo, EmrRepo,
  ExpenseRepo, InventoryRepo, NotificationRepo, PatientRepo, PrescriptionRepo,
  ProviderRepo, ServiceRepo, StaffRepo, TimeSlotRepo,
} from './types';

/**
 * Live backend backed by Supabase/Postgres. Lifted verbatim from the former
 * non-mock branches in queries.ts / mutations.ts / auth.ts. RLS continues to
 * enforce row access; this layer only issues the queries.
 */

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

const auth: AuthRepo = {
  async signIn(identifier, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.includes('@') ? identifier : `${identifier}`,
      password,
    });
    if (error) throw error;
    const profile = await fetchProfile(data.user.id);
    if (!profile.is_active) {
      await supabase.auth.signOut();
      throw new Error('This account has been deactivated. Contact your admin.');
    }
    return profile;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async currentProfile() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    try {
      const profile = await fetchProfile(data.session.user.id);
      if (!profile.is_active) { await supabase.auth.signOut(); return null; }
      return profile;
    } catch {
      return null;
    }
  },

  async currentUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  },

  async sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async changePassword(currentPassword, newPassword) {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email) throw new Error('You are not signed in.');
    // Verify the current password by re-authenticating (Supabase's
    // updateUser does not check the old password on its own).
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInErr) throw new Error('Current password is incorrect.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};

const patients: PatientRepo = {
  async list(search) {
    let query = supabase.from('patients').select('*').order('created_at', { ascending: false });
    if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return data as Patient[];
  },

  async get(id) {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Patient;
  },

  async create(input) {
    const { data, error } = await supabase.from('patients').insert(input).select().single();
    if (error) throw error;
    return data as Patient;
  },

  async update(id, input) {
    const { data, error } = await supabase.from('patients').update(input).eq('id', id).select().single();
    if (error) throw error;
    return data as Patient;
  },
};

const appointments: AppointmentRepo = {
  async list(range) {
    let q = supabase
      .from('appointments')
      .select('*, patient:patients(*), provider:providers(*), appointment_type:appointment_types(*)')
      .order('scheduled_for', { ascending: true });
    if (range) q = q.gte('scheduled_for', range.from).lt('scheduled_for', range.to);
    const { data, error } = await q;
    if (error) throw error;
    return data as Appointment[];
  },

  async byPatient(patientId) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, provider:providers(*), appointment_type:appointment_types(*)')
      .eq('patient_id', patientId)
      .order('scheduled_for', { ascending: false });
    if (error) throw error;
    return data as Appointment[];
  },

  async book(input) {
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
  },

  async setStatus(id, status) {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) throw error;
  },

  async completeSession(appointmentId) {
    const { error } = await supabase.rpc('complete_session', { p_appt: appointmentId });
    if (error) throw error;
  },

  async completeVisitAndBill(appointmentId) {
    await supabase.from('appointments').update({ status: 'COMPLETED' }).eq('id', appointmentId);
    const { data: existing } = await supabase.from('bills').select('*, patient:patients(*)').eq('appointment_id', appointmentId).maybeSingle();
    if (existing) return existing as Bill;

    const { data: appt } = await supabase
      .from('appointments')
      .select('*, appointment_type:appointment_types(*), provider:providers(*)')
      .eq('id', appointmentId).single();
    const type = (appt as any)?.appointment_type as AppointmentType | undefined;
    const provider = (appt as any)?.provider as Provider | undefined;
    const consultation = type?.consultation_fee ?? 0;
    const test = type?.test_fee ?? 0;
    const pct = effectiveSharePct(provider, type);
    return bills.create({
      patient_id: appt!.patient_id,
      provider_id: appt!.provider_id,
      appointment_id: appointmentId,
      consultation_fee: consultation,
      test_fee: test,
      discount: 0,
      doctor_share: doctorShareFor(consultation, test, pct),
    });
  },
};

const services: ServiceRepo = {
  async list() {
    const { data, error } = await supabase.from('appointment_types').select('*').eq('is_active', true);
    if (error) throw error;
    return data as AppointmentType[];
  },

  async create(input) {
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
  },

  async update(id, patch) {
    const { data, error } = await supabase.from('appointment_types').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data as AppointmentType;
  },

  async deactivate(id) {
    const { error } = await supabase.from('appointment_types').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  },
};

const providers: ProviderRepo = {
  async list() {
    const { data, error } = await supabase.from('providers').select('*').eq('is_active', true);
    if (error) throw error;
    return data as Provider[];
  },
};

const timeSlots: TimeSlotRepo = {
  async list(providerId) {
    let q = supabase.from('time_slots').select('*').order('starts_at');
    if (providerId) q = q.eq('provider_id', providerId);
    const { data, error } = await q;
    if (error) throw error;
    return data as TimeSlot[];
  },
};

const bills: BillRepo = {
  async list() {
    const { data, error } = await supabase
      .from('bills')
      .select('*, patient:patients(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Bill[];
  },

  async listOpen() {
    const { data, error } = await supabase
      .from('bills')
      .select('*, patient:patients(*)')
      .in('status', ['PENDING', 'PARTIAL'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Bill[];
  },

  async byPatient(patientId) {
    const { data, error } = await supabase
      .from('bills').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Bill[];
  },

  async byProvider(providerId) {
    // In live mode RLS already restricts a doctor to their own bills.
    const { data, error } = await supabase
      .from('bills').select('*, patient:patients(*)')
      .eq('provider_id', providerId).neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Bill[];
  },

  async create(input) {
    const { data, error } = await supabase.from('bills').insert(input).select('*, patient:patients(*)').single();
    if (error) throw error;
    return data as Bill;
  },

  async recordPayment(billId, amount, method) {
    const { error } = await supabase.from('bill_payments').insert({ bill_id: billId, amount, method });
    if (error) throw error;
  },

  async earnings(providerId, paidOnly) {
    const { data, error } = await supabase.rpc('get_doctor_earnings', {
      p_provider_id: providerId,
      p_paid_only: paidOnly,
    });
    if (error) throw error;
    const row = (data as DoctorEarnings[])?.[0];
    return row ?? { provider_id: providerId, total_share: 0, paid_share: 0, pending_share: 0, bill_count: 0 };
  },
};

const emr: EmrRepo = {
  async byPatient(patientId) {
    const { data, error } = await supabase
      .from('emr').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as EMR[];
  },

  async create(input) {
    const { data, error } = await supabase.from('emr').insert(input).select().single();
    if (error) throw error;
    return data as EMR;
  },
};

const prescriptions: PrescriptionRepo = {
  async byPatient(patientId) {
    const { data, error } = await supabase
      .from('prescriptions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as Prescription[];
  },

  async dueOn(date, providerId) {
    let q = supabase.from('prescriptions').select('*, patient:patients(full_name)').eq('follow_up_date', date);
    if (providerId) q = q.eq('provider_id', providerId);
    const { data, error } = await q;
    if (error) throw error;
    return data as Prescription[];
  },

  async create(input) {
    const { data, error } = await supabase.from('prescriptions').insert(input).select().single();
    if (error) throw error;
    return data as Prescription;
  },
};

const inventory: InventoryRepo = {
  async listItems() {
    const { data, error } = await supabase.from('inventory_items').select('*').eq('is_active', true);
    if (error) throw error;
    return data as InventoryItem[];
  },

  async listMovements() {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('id, item_id, type, quantity, created_at, item:inventory_items(unit_cost)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as any[]).map((m) => ({
      id: m.id, item_id: m.item_id, type: m.type, quantity: m.quantity,
      created_at: m.created_at, unit_cost: m.item?.unit_cost ?? 0,
    })) as StockMovement[];
  },

  async createItem(input) {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({ ...input, quantity: 0 })
      .select().single();
    if (error) throw error;
    return data as InventoryItem;
  },

  async adjustStock(itemId, type, quantity, reason) {
    // The DB trigger applies the quantity change from the movement row.
    const { error } = await supabase.from('stock_movements').insert({ item_id: itemId, type, quantity, reason });
    if (error) throw error;
  },
};

const expenses: ExpenseRepo = {
  async list() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, creator:profiles!expenses_created_by_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as Expense[];
  },

  async create(input, createdBy) {
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...input, created_by: createdBy })
      .select()
      .single();
    if (error) throw error;
    return data as Expense;
  },
};

const staff: StaffRepo = {
  async list() {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) throw error;
    return data as Profile[];
  },

  async create(input) {
    // Create the auth user on a throwaway client so the admin's own
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
  },

  async updateProfile(userId, patch) {
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
  },

  async setActive(profileId, active) {
    const { error } = await supabase.from('profiles').update({ is_active: active }).eq('id', profileId);
    if (error) throw error;
    // Keep them out of (or back into) the bookable doctor directory.
    await supabase.from('providers').update({ is_active: active }).eq('profile_id', profileId);
  },

  async remove(profileId) {
    const { error } = await supabase.rpc('delete_staff', { target: profileId });
    if (error) throw error;
  },
};

// Aggregates live in Postgres (migration 0013) — the dashboards fetch a
// handful of numbers instead of whole tables.
const dashboard: DashboardRepo = {
  async kpis(range) {
    const { data, error } = await supabase.rpc('get_dashboard_kpis', {
      p_from: range.from,
      p_to: range.to,
    });
    if (error) throw error;
    const row = (data as DashboardKpis[])?.[0];
    if (!row) throw new Error('No KPI data returned');
    return row;
  },

  async trends(unit, count, tz) {
    const { data, error } = await supabase.rpc('get_trend_series', {
      p_unit: unit,
      p_count: count,
      p_tz: tz,
    });
    if (error) throw error;
    return data as TrendPoint[];
  },

  async providerShares() {
    const { data, error } = await supabase.rpc('get_provider_shares');
    if (error) throw error;
    return data as ProviderShare[];
  },

  async outstandingByPatient() {
    const { data, error } = await supabase.rpc('get_outstanding_by_patient');
    if (error) throw error;
    return data as OutstandingBalance[];
  },

  async doctorPatientCount(providerId) {
    const { data, error } = await supabase.rpc('get_doctor_patient_count', { p_provider: providerId });
    if (error) throw error;
    return (data as number) ?? 0;
  },
};

const notifications: NotificationRepo = {
  async listMine() {
    // RLS restricts rows to the signed-in recipient automatically.
    const { data, error } = await supabase
      .from('in_app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data as AppNotification[];
  },

  async markRead(id) {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null);
    if (error) throw error;
  },

  async markAllRead() {
    const { error } = await supabase
      .from('in_app_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    if (error) throw error;
  },
};

export const supabaseRepo: ClinicRepo = {
  auth, patients, appointments, services, providers, timeSlots,
  bills, emr, prescriptions, inventory, expenses, staff, notifications, dashboard,
};
