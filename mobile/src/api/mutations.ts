import {
  Appointment, AppointmentType, Bill, EMR, Expense, InventoryItem,
  Prescription, Profile, StockMovementType,
} from '../types/models';
import { repo } from './repo';
import {
  AppointmentTypeInput, BillInput, BookInput, EMRInput, ProfileUpdate,
  RxInput, StaffInput,
} from './repo/types';

/**
 * Write-side facade. Every function delegates to the repository
 * (src/api/repo); only orchestration that is identical for both backends
 * (e.g. opening-stock + expense-ledger bookkeeping) lives here. Exported
 * names and signatures are unchanged so screens keep importing from this
 * module.
 */

// Input shapes now live with the repo contract; re-export for the screens.
export type {
  AppointmentTypeInput, BillInput, BookInput, EMRInput, ProfileUpdate,
  RxInput, StaffInput,
};

// --- Appointments -----------------------------------------------------
export const bookAppointment = (input: BookInput): Promise<Appointment> => repo.appointments.book(input);

export const setAppointmentStatus = (id: string, status: Appointment['status']): Promise<void> =>
  repo.appointments.setStatus(id, status);

export const cancelAppointment = (id: string) => setAppointmentStatus(id, 'CANCELLED');
export const checkInAppointment = (id: string) => setAppointmentStatus(id, 'CHECKED_IN');
export const completeAppointment = (id: string) => setAppointmentStatus(id, 'COMPLETED');
/**
 * Doctor signals their part of the visit is finished (no billing). Reception
 * then completes + collects. Allowed by the appointments_doctor_update_own
 * RLS policy, so it runs as a plain status update for the assigned doctor.
 */
export const markAwaitingPayment = (id: string) => setAppointmentStatus(id, 'AWAITING_PAYMENT');

/**
 * A doctor completes their own session: marks it COMPLETED and generates
 * the bill. Uses the complete_session DB function (migration 0009) so the
 * doctor's role can finalize + bill in one step.
 */
export const completeSession = (appointmentId: string): Promise<void> =>
  repo.appointments.completeSession(appointmentId);

/**
 * Complete a visit AND ensure a bill exists for it (fixes "billing not
 * generated on completion"). Fees + doctor share are derived from the
 * appointment type (see src/services/billing.ts). Returns the bill so the
 * UI can collect payment.
 */
export const completeVisitAndBill = (appointmentId: string): Promise<Bill> =>
  repo.appointments.completeVisitAndBill(appointmentId);

// --- Billing ----------------------------------------------------------
export const createBill = (input: BillInput): Promise<Bill> => repo.bills.create(input);

export const recordPayment = (billId: string, amount: number, method = 'cash'): Promise<void> =>
  repo.bills.recordPayment(billId, amount, method);

// --- EMR --------------------------------------------------------------
export const createEMR = (input: EMRInput): Promise<EMR> => repo.emr.create(input);

// --- Prescriptions ----------------------------------------------------
export const createPrescription = (input: RxInput): Promise<Prescription> => repo.prescriptions.create(input);

// --- In-app notifications (v2) ----------------------------------------
export const markNotificationRead = (id: string): Promise<void> => repo.notifications.markRead(id);
export const markAllNotificationsRead = (): Promise<void> => repo.notifications.markAllRead();

// --- Inventory (admin) ------------------------------------------------
/**
 * Create an item, book its opening stock as an ADD movement (so the
 * purchase cost is recorded — the DB trigger raises the quantity), and
 * record the purchase in the expense ledger. The same flow applies to both
 * backends, so the orchestration lives here once.
 */
export async function createInventoryItem(input: Partial<InventoryItem>): Promise<InventoryItem> {
  const initialQty = input.quantity ?? 0;
  const unitCost = input.unit_cost ?? 0;
  const item = await repo.inventory.createItem({ ...input, quantity: 0 });
  if (initialQty > 0) await adjustStock(item.id, 'ADD', initialQty, 'Initial stock');
  if (initialQty > 0 && unitCost > 0) {
    await createExpense({
      category: 'Inventory',
      description: `Inventory: ${item.name} (${initialQty} ${item.unit} @ ${unitCost})`,
      amount: initialQty * unitCost,
    });
  }
  return item;
}

export const adjustStock = (itemId: string, type: StockMovementType, quantity: number, reason?: string): Promise<void> =>
  repo.inventory.adjustStock(itemId, type, quantity, reason);

// --- Expenses ---------------------------------------------------------
/** Stamps created_by with the signed-in user before handing to the backend. */
export async function createExpense(input: Partial<Expense>): Promise<Expense> {
  const createdBy = await repo.auth.currentUserId();
  return repo.expenses.create(input, createdBy);
}

// --- Appointment types / services & prices (admin + receptionist) ------
export const createAppointmentType = (input: AppointmentTypeInput): Promise<AppointmentType> =>
  repo.services.create(input);

export const updateAppointmentType = (id: string, patch: Partial<AppointmentTypeInput>): Promise<AppointmentType> =>
  repo.services.update(id, patch);

// Soft-delete: hide the service from the catalog while keeping past
// appointments/bills that referenced it intact (FK is ON DELETE SET NULL).
export const deleteAppointmentType = (id: string): Promise<void> => repo.services.deactivate(id);

// --- Staff (admin) ----------------------------------------------------
export const createStaff = (input: StaffInput): Promise<Profile> => repo.staff.create(input);

/**
 * Update the signed-in user's own profile (any role). Edits name/phone/photo;
 * email & role are intentionally not changeable here. For doctors, the linked
 * provider row is kept in sync so the booking directory shows the new name/photo.
 */
export const updateMyProfile = (userId: string, patch: ProfileUpdate): Promise<Profile> =>
  repo.staff.updateProfile(userId, patch);

/** Enable/disable a staff member's access (reversible). */
export const setStaffActive = (profileId: string, active: boolean): Promise<void> =>
  repo.staff.setActive(profileId, active);

/** Permanently delete a staff account (login + provider). Needs migration 0008. */
export const deleteStaff = (profileId: string): Promise<void> => repo.staff.remove(profileId);
