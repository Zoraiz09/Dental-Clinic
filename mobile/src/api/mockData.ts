// In-memory demo data powering MOCK mode (no Supabase creds yet).
// Mirrors the seed in supabase/seed.sql and the UI mockups.
import {
  Appointment, AppointmentType, Bill, DoctorEarnings, EMR, Expense,
  InventoryItem, Patient, Prescription, Profile, Provider, TimeSlot, UserRole,
} from '../types/models';

export const mockProviders: Provider[] = [
  { id: 'pv1', profile_id: null, full_name: 'Dr. Ethan Walker', title: 'Senior Facial Aesthetic Specialist', specialty: 'AESTHETIC', is_primary: true, avatar_url: null, is_active: true, employment_type: 'IN_HOUSE', default_share_pct: 50 },
  { id: 'pv2', profile_id: null, full_name: 'Dr. Sarah Chen', title: 'Maxillofacial Surgeon', specialty: 'DENTAL', is_primary: false, avatar_url: null, is_active: true, employment_type: 'VISITING', default_share_pct: 60 },
  // The demo DOCTOR account (doctor@noor.clinic = Dr. Jenkins) maps here.
  { id: 'pv3', profile_id: 'u-doc', full_name: 'Dr. Jenkins', title: 'General Dentist', specialty: 'DENTAL', is_primary: false, avatar_url: null, is_active: true, employment_type: 'IN_HOUSE', default_share_pct: 45 },
];

// Demo staff accounts for MOCK login. Password is ignored in mock mode.
export const mockProfiles: (Profile & { password: string })[] = [
  { id: 'u-admin', full_name: 'Admin User', email: 'admin@noor.clinic', phone: '+923001112233', role: 'ADMIN', avatar_url: null, is_active: true, password: 'password' },
  { id: 'u-doc', full_name: 'Dr. Jenkins', email: 'doctor@noor.clinic', phone: '+923004445566', role: 'DOCTOR', avatar_url: null, is_active: true, password: 'password' },
  { id: 'u-recep', full_name: 'Front Desk', email: 'reception@noor.clinic', phone: '+923007778899', role: 'RECEPTIONIST', avatar_url: null, is_active: true, password: 'password' },
];

export const mockAppointmentTypes: AppointmentType[] = [
  { id: 'at1', name: 'General Check-up', specialty: 'DENTAL', duration_minutes: 30, consultation_fee: 2000, test_fee: 0, default_doctor_pct: 40, is_active: true },
  { id: 'at2', name: 'Tooth Extraction', specialty: 'DENTAL', duration_minutes: 45, consultation_fee: 5000, test_fee: 1000, default_doctor_pct: 50, is_active: true },
  { id: 'at3', name: 'Scaling & Polishing', specialty: 'DENTAL', duration_minutes: 40, consultation_fee: 3500, test_fee: 0, default_doctor_pct: 45, is_active: true },
  { id: 'at4', name: 'Botox Consultation', specialty: 'AESTHETIC', duration_minutes: 30, consultation_fee: 4000, test_fee: 0, default_doctor_pct: 50, is_active: true },
  { id: 'at5', name: 'Dermal Fillers', specialty: 'AESTHETIC', duration_minutes: 60, consultation_fee: 15000, test_fee: 0, default_doctor_pct: 55, is_active: true },
];

export const mockPatients: Patient[] = [
  { id: 'p1', mrn: 'NDC-0001', full_name: 'Eleanor Vance', phone: '+923001234567', email: 'eleanor@example.com', gender: 'Female', date_of_birth: '1990-04-12', address: 'Gulberg, Lahore', photo_url: null, notes: 'Deep Sedation — Orthognathic Prep', created_at: '2026-05-20T09:00:00Z' },
  { id: 'p2', mrn: 'NDC-0002', full_name: 'Arthur Morgan', phone: '+923004445566', email: null, gender: 'Male', date_of_birth: '1985-09-30', address: 'DHA, Lahore', photo_url: null, notes: 'Post-op follow up', created_at: '2026-05-22T10:30:00Z' },
  { id: 'p3', mrn: 'NDC-0003', full_name: 'Sarah Linton', phone: '+923007778899', email: null, gender: 'Female', date_of_birth: '1998-01-22', address: 'Model Town, Lahore', photo_url: null, notes: '', created_at: '2026-05-28T14:00:00Z' },
  { id: 'p4', mrn: 'NDC-0004', full_name: 'James Whitfield', phone: '+923009990011', email: null, gender: 'Male', date_of_birth: '1972-11-03', address: 'Johar Town, Lahore', photo_url: null, notes: '', created_at: '2026-06-01T11:15:00Z' },
];

const today = '2026-06-05';
export const mockTimeSlots: TimeSlot[] = [
  { id: 's1', provider_id: 'pv1', starts_at: `${today}T09:00:00Z`, ends_at: `${today}T09:30:00Z`, is_available: true },
  { id: 's2', provider_id: 'pv1', starts_at: `${today}T09:30:00Z`, ends_at: `${today}T10:00:00Z`, is_available: true },
  { id: 's3', provider_id: 'pv1', starts_at: `${today}T10:00:00Z`, ends_at: `${today}T10:30:00Z`, is_available: true },
  { id: 's4', provider_id: 'pv1', starts_at: `${today}T10:30:00Z`, ends_at: `${today}T11:00:00Z`, is_available: true },
  { id: 's5', provider_id: 'pv1', starts_at: `${today}T11:00:00Z`, ends_at: `${today}T11:30:00Z`, is_available: true },
  { id: 's6', provider_id: 'pv1', starts_at: `${today}T11:30:00Z`, ends_at: `${today}T12:00:00Z`, is_available: false },
];

export const mockAppointments: Appointment[] = [
  { id: 'a1', patient_id: 'p1', provider_id: 'pv3', appointment_type_id: 'at2', time_slot_id: 's3', status: 'CONFIRMED', scheduled_for: `${today}T10:00:00Z`, queue_number: null, reason: 'Orthognathic Prep', patient: mockPatients[0], provider: mockProviders[2], appointment_type: mockAppointmentTypes[1] },
  { id: 'a2', patient_id: 'p2', provider_id: 'pv3', appointment_type_id: 'at1', time_slot_id: null, status: 'CHECKED_IN', scheduled_for: `${today}T10:30:00Z`, queue_number: 1, reason: 'Follow up', patient: mockPatients[1], provider: mockProviders[2], appointment_type: mockAppointmentTypes[0] },
  { id: 'a3', patient_id: 'p3', provider_id: 'pv1', appointment_type_id: 'at4', time_slot_id: null, status: 'BOOKED', scheduled_for: `${today}T13:00:00Z`, queue_number: null, reason: 'Consultation', patient: mockPatients[2], provider: mockProviders[0], appointment_type: mockAppointmentTypes[3] },
];

export const mockBills: Bill[] = [
  { id: 'b1', invoice_no: 'INV-1001', patient_id: 'p1', appointment_id: 'a1', provider_id: 'pv3', consultation_fee: 5000, test_fee: 1000, discount: 0, total_amount: 6000, doctor_share: 3000, clinic_share: 3000, amount_paid: 6000, status: 'PAID', created_at: `${today}T10:45:00Z`, patient: mockPatients[0] },
  { id: 'b2', invoice_no: 'INV-1002', patient_id: 'p2', appointment_id: 'a2', provider_id: 'pv3', consultation_fee: 2000, test_fee: 0, discount: 0, total_amount: 2000, doctor_share: 800, clinic_share: 1200, amount_paid: 0, status: 'PENDING', created_at: `${today}T11:00:00Z`, patient: mockPatients[1] },
  { id: 'b3', invoice_no: 'INV-1003', patient_id: 'p3', appointment_id: null, provider_id: 'pv1', consultation_fee: 15000, test_fee: 0, discount: 1000, total_amount: 14000, doctor_share: 7700, clinic_share: 6300, amount_paid: 14000, status: 'PAID', created_at: `${today}T12:30:00Z`, patient: mockPatients[2] },
  // More Dr. Jenkins (pv3) bills across the past week → richer earnings chart.
  { id: 'b4', invoice_no: 'INV-0995', patient_id: 'p4', appointment_id: null, provider_id: 'pv3', consultation_fee: 3500, test_fee: 0, discount: 0, total_amount: 3500, doctor_share: 1575, clinic_share: 1925, amount_paid: 3500, status: 'PAID', created_at: '2026-06-04T11:00:00Z', patient: mockPatients[3] },
  { id: 'b5', invoice_no: 'INV-0990', patient_id: 'p1', appointment_id: null, provider_id: 'pv3', consultation_fee: 5000, test_fee: 1000, discount: 0, total_amount: 6000, doctor_share: 3000, clinic_share: 3000, amount_paid: 6000, status: 'PAID', created_at: '2026-06-03T09:30:00Z', patient: mockPatients[0] },
  { id: 'b6', invoice_no: 'INV-0985', patient_id: 'p2', appointment_id: null, provider_id: 'pv3', consultation_fee: 2000, test_fee: 0, discount: 0, total_amount: 2000, doctor_share: 800, clinic_share: 1200, amount_paid: 0, status: 'PENDING', created_at: '2026-06-02T15:00:00Z', patient: mockPatients[1] },
  { id: 'b7', invoice_no: 'INV-0980', patient_id: 'p3', appointment_id: null, provider_id: 'pv3', consultation_fee: 3500, test_fee: 500, discount: 0, total_amount: 4000, doctor_share: 1800, clinic_share: 2200, amount_paid: 4000, status: 'PAID', created_at: '2026-06-01T13:15:00Z', patient: mockPatients[2] },
];

export const mockInventory: InventoryItem[] = [
  { id: 'i1', name: 'Dental Anesthetic Cartridge', sku: 'NDC-AN-001', unit: 'box', quantity: 3, reorder_level: 5, unit_cost: 1200, is_active: true },
  { id: 'i2', name: 'Composite Filling Resin', sku: 'NDC-CF-002', unit: 'tube', quantity: 12, reorder_level: 10, unit_cost: 800, is_active: true },
  { id: 'i3', name: 'Disposable Gloves (M)', sku: 'NDC-GL-003', unit: 'box', quantity: 25, reorder_level: 15, unit_cost: 450, is_active: true },
  { id: 'i4', name: 'Dermal Filler 1ml', sku: 'NDC-DF-004', unit: 'vial', quantity: 4, reorder_level: 6, unit_cost: 9000, is_active: true },
  { id: 'i5', name: 'Botulinum Toxin 100u', sku: 'NDC-BT-005', unit: 'vial', quantity: 2, reorder_level: 3, unit_cost: 18000, is_active: true },
];

export const mockExpenses: Expense[] = [
  { id: 'e1', category: 'Utilities', description: 'Electricity bill — May', amount: 45000, receipt_url: null, spent_at: '2026-06-02' },
  { id: 'e2', category: 'Supplies', description: 'Sterilization pouches', amount: 8500, receipt_url: null, spent_at: '2026-06-03' },
];

export const mockStockMovements: { id: string; item_id: string; type: 'ADD' | 'DEDUCT' | 'ADJUST'; quantity: number; created_at: string }[] = [];

export const mockEMR: EMR[] = [
  {
    id: 'emr1', patient_id: 'p1', appointment_id: 'a1', provider_id: 'pv3', specialty: 'DENTAL',
    chief_complaint: 'Pain in lower left molar', diagnosis: 'Irreversible pulpitis #36',
    treatment_plan: 'Extraction under deep sedation; orthognathic prep',
    tooth_chart: { '36': { condition: 'extraction', note: 'Pulpitis' }, '37': { condition: 'caries' } },
    aesthetic_data: {}, notes: 'Patient tolerated procedure well.', created_at: '2026-05-20T10:30:00Z',
  },
  {
    id: 'emr2', patient_id: 'p3', appointment_id: null, provider_id: 'pv1', specialty: 'AESTHETIC',
    chief_complaint: 'Fine lines, glabellar frown', diagnosis: 'Dynamic rhytids',
    treatment_plan: 'Botulinum toxin 20u glabella + forehead',
    tooth_chart: {}, aesthetic_data: { areas: ['Glabella', 'Forehead'], units: 20, product: 'Botulinum Toxin' },
    notes: '', created_at: '2026-05-28T14:20:00Z',
  },
];

export const mockPrescriptions: Prescription[] = [
  {
    id: 'rx1', patient_id: 'p1', emr_id: 'emr1', provider_id: 'pv3', rx_type: 'DENTAL',
    items: [
      { drug: 'Amoxicillin 500mg', dose: '1 cap', frequency: 'TDS', duration: '5 days' },
      { drug: 'Ibuprofen 400mg', dose: '1 tab', frequency: 'BD', duration: '3 days', notes: 'After meals' },
    ],
    advice: 'Soft diet for 48 hours. Avoid hot drinks.', follow_up_date: '2026-06-10', created_at: '2026-05-20T10:45:00Z',
  },
];

// Task list shown on the doctor's Home dashboard (mockup).
export interface TaskItem { id: string; title: string; subtitle?: string; priority?: 'High' | 'Normal'; done: boolean; }
export const mockTasks: TaskItem[] = [
  { id: 't1', title: 'Approve Lab Scan #4022', subtitle: 'Due by 12:00 PM', priority: 'High', done: false },
  { id: 't2', title: 'Sign Post-Op instruction', subtitle: 'Patient: Arthur M.', done: false },
  { id: 't3', title: 'Consultation Call', subtitle: 'Follow up with Sarah L.', done: false },
  { id: 't4', title: 'Inventory Review', subtitle: 'Implants stock low', done: false },
];

export function earningsFor(providerId: string, paidOnly = false): DoctorEarnings {
  const bills = mockBills.filter((b) => b.provider_id === providerId && b.status !== 'CANCELLED');
  const total = bills.reduce((s, b) => s + b.doctor_share, 0);
  const paid = bills.filter((b) => b.status === 'PAID').reduce((s, b) => s + b.doctor_share, 0);
  return {
    provider_id: providerId,
    total_share: paidOnly ? paid : total,
    paid_share: paid,
    pending_share: total - paid,
    bill_count: bills.length,
  };
}

export const dashboardKpis: Record<UserRole, { label: string; value: string }[]> = {
  DOCTOR: [
    { label: "TODAY'S APPS", value: '12' },
    { label: 'PENDING CHARTS', value: '4' },
    { label: 'NEW CONSULTS', value: '2' },
    { label: 'UNREAD LAB REPORTS', value: '7' },
  ],
  RECEPTIONIST: [
    { label: "TODAY'S APPS", value: '12' },
    { label: 'CHECKED IN', value: '5' },
    { label: 'PENDING BILLS', value: '3' },
    { label: 'NEW PATIENTS', value: '2' },
  ],
  ADMIN: [
    { label: "TODAY'S REVENUE", value: 'Rs 22k' },
    { label: 'APPOINTMENTS', value: '12' },
    { label: 'LOW STOCK', value: '3' },
    { label: 'STAFF ON DUTY', value: '6' },
  ],
};
