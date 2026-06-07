// Domain types mirroring the Supabase schema (supabase/migrations).
// Kept hand-written and small; regenerate with `supabase gen types` later.

export type UserRole = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST';
export type Specialty = 'DENTAL' | 'AESTHETIC';
export type AppointmentStatus =
  | 'BOOKED' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type BillStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
export type PrescriptionType = 'DENTAL' | 'FACIAL';
export type StockMovementType = 'ADD' | 'DEDUCT' | 'ADJUST';
export type EmploymentType = 'IN_HOUSE' | 'VISITING';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
}

export interface Provider {
  id: string;
  profile_id: string | null;
  full_name: string;
  title: string | null;
  specialty: Specialty | null;
  is_primary: boolean;
  avatar_url: string | null;
  is_active: boolean;
  employment_type: EmploymentType;
  default_share_pct: number;
}

export interface Patient {
  id: string;
  mrn: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  specialty: Specialty | null;
  duration_minutes: number;
  consultation_fee: number;
  test_fee: number;
  default_doctor_pct: number;
  is_active: boolean;
}

export interface TimeSlot {
  id: string;
  provider_id: string | null;
  starts_at: string;
  ends_at: string;
  is_available: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  provider_id: string | null;
  appointment_type_id: string | null;
  time_slot_id: string | null;
  status: AppointmentStatus;
  scheduled_for: string;
  queue_number: number | null;
  reason: string | null;
  // joined conveniences
  patient?: Patient;
  provider?: Provider;
  appointment_type?: AppointmentType;
}

export interface ToothChart {
  // tooth number (FDI/Universal) -> condition/state
  [tooth: string]: { condition?: string; surfaces?: string[]; note?: string };
}

export interface EMR {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  provider_id: string | null;
  specialty: Specialty;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  tooth_chart: ToothChart;
  aesthetic_data: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface RxItem {
  drug: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  emr_id: string | null;
  provider_id: string | null;
  rx_type: PrescriptionType;
  items: RxItem[];
  advice: string | null;
  follow_up_date: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  invoice_no: string | null;
  patient_id: string;
  appointment_id: string | null;
  provider_id: string | null;
  consultation_fee: number;
  test_fee: number;
  discount: number;
  total_amount: number;
  doctor_share: number;
  clinic_share: number;
  amount_paid: number;
  status: BillStatus;
  created_at: string;
  patient?: Patient;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  quantity: number;
  reorder_level: number;
  unit_cost: number;
  is_active: boolean;
}

export interface StockMovement {
  id: string;
  item_id: string;
  type: StockMovementType;
  quantity: number;
  created_at: string;
  unit_cost?: number; // joined from inventory_items for cost calc
}

export interface Expense {
  id: string;
  category: string | null;
  description: string;
  amount: number;
  receipt_url: string | null;
  spent_at: string;
  created_at?: string;   // full timestamp (date + time) the entry was recorded
}

export interface DoctorEarnings {
  provider_id: string;
  total_share: number;
  paid_share: number;
  pending_share: number;
  bill_count: number;
}
