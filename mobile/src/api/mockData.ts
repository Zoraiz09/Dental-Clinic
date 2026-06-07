// In-memory demo data powering MOCK mode (no Supabase creds yet).
// Mirrors the seed in supabase/seed.sql and the UI mockups.
import dayjs from 'dayjs';
import {
  Appointment, AppointmentType, Bill, DoctorEarnings, EMR, Expense,
  InventoryItem, Patient, Prescription, Profile, Provider, Specialty, TimeSlot, UserRole,
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

// Catalog extracted from the Noor Dentofacial Clinic price lists (Dental +
// Aesthetic). For services priced as a range, the starting (lower) price is
// seeded here — admins/receptionists can fine-tune any price in-app.
// `consultation_fee` is the service price; bill total = consultation_fee + test_fee − discount.
const apptType = (
  id: string, name: string, specialty: Specialty, consultation_fee: number,
  duration_minutes = 30, default_doctor_pct = 50,
): AppointmentType => ({ id, name, specialty, duration_minutes, consultation_fee, test_fee: 0, default_doctor_pct, is_active: true });

export const mockAppointmentTypes: AppointmentType[] = [
  // ---- Dental ----
  apptType('at1', 'Consultation / Examination', 'DENTAL', 1000, 15),
  apptType('at2', 'Dental Filling (GIC)', 'DENTAL', 3000),
  apptType('at3', 'Composite Filling (Light Cure)', 'DENTAL', 6000),
  apptType('at4', 'Amalgam Filling', 'DENTAL', 3500),
  apptType('at5', 'RCT (Anterior Tooth)', 'DENTAL', 10000, 45),
  apptType('at6', 'RCT (Premolar)', 'DENTAL', 12000, 45),
  apptType('at7', 'RCT (Molar)', 'DENTAL', 15000, 60),
  apptType('at8', 'Re-RCT', 'DENTAL', 12000, 60),
  apptType('at9', 'Pulpotomy / Pulpectomy', 'DENTAL', 3500),
  apptType('at10', 'Extraction (Normal)', 'DENTAL', 4000),
  apptType('at11', 'Surgical Extraction', 'DENTAL', 10000, 45),
  apptType('at12', 'Apicectomy', 'DENTAL', 15000, 60),
  apptType('at13', 'Scaling & Polishing', 'DENTAL', 8000, 40),
  apptType('at14', 'Deep Scaling / Root Planing', 'DENTAL', 10000, 45),
  apptType('at15', 'Fluoride Varnish', 'DENTAL', 3000, 20),
  apptType('at16', 'Functional Crown Lengthening', 'DENTAL', 10000, 45),
  apptType('at17', 'Esthetic Crown Lengthening', 'DENTAL', 25000, 60),
  apptType('at18', 'Free Graft', 'DENTAL', 30000, 60),
  apptType('at19', 'PFM Crown', 'DENTAL', 12000, 45),
  apptType('at20', 'Zirconia Crown', 'DENTAL', 25000, 45),
  apptType('at21', 'E-max Crown', 'DENTAL', 28000, 45),
  apptType('at22', 'Temporary Crown', 'DENTAL', 4000),
  apptType('at23', 'Crown Cementation', 'DENTAL', 2500),
  apptType('at24', 'Partial Acrylic Denture', 'DENTAL', 8000, 45),
  apptType('at25', 'Flexible Denture', 'DENTAL', 15000, 45),
  apptType('at26', 'Complete Denture', 'DENTAL', 35000, 60),
  apptType('at27', 'Single Tooth Denture', 'DENTAL', 3500),
  apptType('at28', 'Dental Implant', 'DENTAL', 70000, 60),
  apptType('at29', 'Bone Graft (if required)', 'DENTAL', 20000, 60),
  apptType('at30', 'Metal Braces', 'DENTAL', 120000, 60),
  apptType('at31', 'Ceramic Braces', 'DENTAL', 150000, 60),
  apptType('at32', 'Invisible Aligners', 'DENTAL', 200000, 60),
  apptType('at33', 'Retainers', 'DENTAL', 5000),
  apptType('at34', 'Teeth Whitening / Bleaching', 'DENTAL', 30000, 60),
  apptType('at35', 'Veneers (per tooth)', 'DENTAL', 25000, 45),
  apptType('at36', 'Night Guard', 'DENTAL', 6000),
  apptType('at37', 'Dental Splint', 'DENTAL', 6000),
  // ---- Aesthetic · Face ----
  apptType('at38', 'Essential HydraFacial', 'AESTHETIC', 7000, 45),
  apptType('at39', 'Galvanic HydraFacial', 'AESTHETIC', 8000, 45),
  apptType('at40', 'Skin Renewal Hydrafacial', 'AESTHETIC', 8000, 60),
  apptType('at41', 'Signature HydraFacial', 'AESTHETIC', 10000, 60),
  apptType('at42', 'Vampire Facial (Microneedling + PRP)', 'AESTHETIC', 8000, 60),
  apptType('at43', 'Microneedling & Mesotherapy', 'AESTHETIC', 10000, 60),
  apptType('at44', 'Black Doll Facial (Carbon Peel)', 'AESTHETIC', 9000, 45),
  apptType('at45', 'Freckles & Melasma Removal', 'AESTHETIC', 8000, 45),
  apptType('at46', 'Tattoo Removal', 'AESTHETIC', 5000, 45),
  apptType('at47', 'Chemical Peel (Full Face)', 'AESTHETIC', 9000, 45),
  apptType('at48', 'Mole Removal', 'AESTHETIC', 2000),
  apptType('at49', 'Botox (Full Face)', 'AESTHETIC', 25000, 45),
  apptType('at50', 'Frown Lines', 'AESTHETIC', 20000),
  apptType('at51', 'Gummy Smile', 'AESTHETIC', 18000),
  apptType('at52', "Crow's Feet", 'AESTHETIC', 15000),
  apptType('at53', 'Bunny Lines', 'AESTHETIC', 15000),
  apptType('at54', 'Hyperhidrosis (Underarms)', 'AESTHETIC', 30000, 45),
  apptType('at55', 'Mesotherapy', 'AESTHETIC', 8000, 45),
  apptType('at56', 'Fat Dissolving Injections (Face)', 'AESTHETIC', 9000, 45),
  apptType('at57', 'HIFU Full Face', 'AESTHETIC', 15000, 60),
  apptType('at58', 'HIFU Double Chin', 'AESTHETIC', 15000, 45),
  apptType('at59', 'HIFU Full Face + Double Chin', 'AESTHETIC', 25000, 60),
  apptType('at60', 'Laser Hair Removal – Forehead', 'AESTHETIC', 2000, 20),
  apptType('at61', 'Laser Hair Removal – Upper Lip', 'AESTHETIC', 1500, 20),
  apptType('at62', 'Laser Hair Removal – Chin & Jawline', 'AESTHETIC', 2500, 20),
  apptType('at63', 'Laser Hair Removal – Full Face', 'AESTHETIC', 5500, 30),
  // ---- Aesthetic · Hair & Body ----
  apptType('at64', 'Hair PRP', 'AESTHETIC', 6000, 45),
  apptType('at65', 'Mesotherapy Hair Booster', 'AESTHETIC', 8000, 45),
  apptType('at66', 'PDO Threads (Hair)', 'AESTHETIC', 18000, 60),
  apptType('at67', 'PDO Threads (Skin)', 'AESTHETIC', 18000, 60),
  apptType('at68', 'Chemical Peel (Knuckles)', 'AESTHETIC', 3000, 30),
  apptType('at69', 'Chemical Peel (Neck)', 'AESTHETIC', 5000, 30),
  apptType('at70', 'Chemical Peel (Hands)', 'AESTHETIC', 5000, 30),
  apptType('at71', 'Chemical Peel (Feet)', 'AESTHETIC', 5000, 30),
  apptType('at72', 'Carbon Peel (Hands/Feet)', 'AESTHETIC', 5000, 30),
  apptType('at73', 'Lightening Cocktail (IV Drip)', 'AESTHETIC', 9000, 45),
  apptType('at74', 'Slimming Cocktail (IV Drip)', 'AESTHETIC', 10000, 45),
  apptType('at75', 'Vitamin Immune Cocktail (IV Drip)', 'AESTHETIC', 12000, 45),
  apptType('at76', 'HIFU Upper Arms', 'AESTHETIC', 15000, 45),
  apptType('at77', 'HIFU Thighs', 'AESTHETIC', 20000, 60),
  apptType('at78', 'HIFU Tummy', 'AESTHETIC', 25000, 60),
  apptType('at79', 'Laser Hair Removal – Armpits', 'AESTHETIC', 4500, 30),
  apptType('at80', 'Laser Hair Removal – Lower Arm', 'AESTHETIC', 3500, 30),
  apptType('at81', 'Laser Hair Removal – Upper Arm', 'AESTHETIC', 3500, 30),
  apptType('at82', 'Laser Hair Removal – Full Arms', 'AESTHETIC', 6000, 45),
  apptType('at83', 'Laser Hair Removal – Lower Legs', 'AESTHETIC', 4500, 30),
  apptType('at84', 'Laser Hair Removal – Thighs', 'AESTHETIC', 4500, 30),
  apptType('at85', 'Laser Hair Removal – Full Legs', 'AESTHETIC', 8000, 45),
  apptType('at86', 'Laser Hair Removal – Tummy Area', 'AESTHETIC', 5000, 30),
  apptType('at87', 'Laser Hair Removal – Full Back', 'AESTHETIC', 7000, 45),
  apptType('at88', 'Laser Hair Removal – Half Body', 'AESTHETIC', 12000, 60),
  apptType('at89', 'Laser Hair Removal – Full Body', 'AESTHETIC', 25000, 90),
];

export const mockPatients: Patient[] = [
  { id: 'p1', mrn: 'NDC-0001', full_name: 'Eleanor Vance', phone: '+923001234567', email: 'eleanor@example.com', gender: 'Female', date_of_birth: '1990-04-12', address: 'Gulberg, Lahore', photo_url: null, notes: 'Deep Sedation — Orthognathic Prep', created_at: '2026-05-20T09:00:00Z' },
  { id: 'p2', mrn: 'NDC-0002', full_name: 'Arthur Morgan', phone: '+923004445566', email: null, gender: 'Male', date_of_birth: '1985-09-30', address: 'DHA, Lahore', photo_url: null, notes: 'Post-op follow up', created_at: '2026-05-22T10:30:00Z' },
  { id: 'p3', mrn: 'NDC-0003', full_name: 'Sarah Linton', phone: '+923007778899', email: null, gender: 'Female', date_of_birth: '1998-01-22', address: 'Model Town, Lahore', photo_url: null, notes: '', created_at: '2026-05-28T14:00:00Z' },
  { id: 'p4', mrn: 'NDC-0004', full_name: 'James Whitfield', phone: '+923009990011', email: null, gender: 'Male', date_of_birth: '1972-11-03', address: 'Johar Town, Lahore', photo_url: null, notes: '', created_at: '2026-06-01T11:15:00Z' },
];

// Anchor demo data to the real current day so "Today's schedule" and
// today-based KPIs always populate (was hardcoded, which left them empty
// on any other date).
const today = dayjs().format('YYYY-MM-DD');
// Timestamp `n` days before now, at the given hour — keeps the "past week"
// earnings/expense demo data rolling with the real date.
const daysAgo = (n: number, hour = 10) =>
  dayjs().subtract(n, 'day').hour(hour).minute(0).second(0).millisecond(0).toISOString();
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
  { id: 'b4', invoice_no: 'INV-0995', patient_id: 'p4', appointment_id: null, provider_id: 'pv3', consultation_fee: 3500, test_fee: 0, discount: 0, total_amount: 3500, doctor_share: 1575, clinic_share: 1925, amount_paid: 3500, status: 'PAID', created_at: daysAgo(1, 11), patient: mockPatients[3] },
  { id: 'b5', invoice_no: 'INV-0990', patient_id: 'p1', appointment_id: null, provider_id: 'pv3', consultation_fee: 5000, test_fee: 1000, discount: 0, total_amount: 6000, doctor_share: 3000, clinic_share: 3000, amount_paid: 6000, status: 'PAID', created_at: daysAgo(2, 9), patient: mockPatients[0] },
  { id: 'b6', invoice_no: 'INV-0985', patient_id: 'p2', appointment_id: null, provider_id: 'pv3', consultation_fee: 2000, test_fee: 0, discount: 0, total_amount: 2000, doctor_share: 800, clinic_share: 1200, amount_paid: 0, status: 'PENDING', created_at: daysAgo(4, 15), patient: mockPatients[1] },
  { id: 'b7', invoice_no: 'INV-0980', patient_id: 'p3', appointment_id: null, provider_id: 'pv3', consultation_fee: 3500, test_fee: 500, discount: 0, total_amount: 4000, doctor_share: 1800, clinic_share: 2200, amount_paid: 4000, status: 'PAID', created_at: daysAgo(6, 13), patient: mockPatients[2] },
];

export const mockInventory: InventoryItem[] = [
  { id: 'i1', name: 'Dental Anesthetic Cartridge', sku: 'NDC-AN-001', unit: 'box', quantity: 3, reorder_level: 5, unit_cost: 1200, is_active: true },
  { id: 'i2', name: 'Composite Filling Resin', sku: 'NDC-CF-002', unit: 'tube', quantity: 12, reorder_level: 10, unit_cost: 800, is_active: true },
  { id: 'i3', name: 'Disposable Gloves (M)', sku: 'NDC-GL-003', unit: 'box', quantity: 25, reorder_level: 15, unit_cost: 450, is_active: true },
  { id: 'i4', name: 'Dermal Filler 1ml', sku: 'NDC-DF-004', unit: 'vial', quantity: 4, reorder_level: 6, unit_cost: 9000, is_active: true },
  { id: 'i5', name: 'Botulinum Toxin 100u', sku: 'NDC-BT-005', unit: 'vial', quantity: 2, reorder_level: 3, unit_cost: 18000, is_active: true },
];

export const mockExpenses: Expense[] = [
  { id: 'e1', category: 'Utilities', description: 'Electricity bill', amount: 45000, receipt_url: null, spent_at: daysAgo(4).slice(0, 10), created_at: daysAgo(4, 10) },
  { id: 'e2', category: 'Supplies', description: 'Sterilization pouches', amount: 8500, receipt_url: null, spent_at: daysAgo(3).slice(0, 10), created_at: daysAgo(3, 14) },
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
