import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Bill, Patient, Prescription, RxItem } from '../types/models';
import { rs, shortDate } from './format';

// Shared branded shell for all clinic documents (NDC look).
function shell(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    * { font-family: -apple-system, Helvetica, Arial, sans-serif; }
    body { padding: 40px; color: #36281C; }
    .brand { color: #80531F; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .sub { color: #9C6A30; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .rule { height: 3px; background: #80531F; margin: 16px 0 22px; border-radius: 2px; }
    .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .muted { color: #6B7280; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #6B7280; padding: 8px 6px; border-bottom: 2px solid #E6E3DC; }
    td { font-size: 13px; padding: 10px 6px; border-bottom: 1px solid #EFEBE3; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .b { font-weight: 700; }
    .foot { margin-top: 40px; color: #6B7280; font-size: 11px; text-align: center; }
    .pill { display:inline-block; background:#F1E3CC; color:#80531F; font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; }
  </style></head><body>
    <div class="brand">Noor Dentofacial Clinic</div>
    <div class="sub">Dental &amp; Aesthetic Care</div>
    <div class="rule"></div>
    <div class="title">${title}</div>
    ${body}
    <div class="foot">Noor Dentofacial Clinic · Generated on ${shortDate(new Date().toISOString())} · This is a computer-generated document.</div>
  </body></html>`;
}

function rxHtml(patient: Patient, rx: Prescription, doctor?: string): string {
  const rows = rx.items
    .map(
      (it: RxItem) => `<tr><td class="b">${it.drug}</td><td>${it.dose ?? '—'}</td><td>${it.frequency ?? '—'}</td><td>${it.duration ?? '—'}</td><td>${it.notes ?? ''}</td></tr>`,
    )
    .join('');
  return shell(
    `${rx.rx_type === 'DENTAL' ? 'Dental' : 'Aesthetic'} Prescription`,
    `<div class="row"><span class="muted">Patient</span><span class="b">${patient.full_name}</span></div>
     <div class="row"><span class="muted">MRN</span><span>${patient.mrn ?? '—'}</span></div>
     <div class="row"><span class="muted">Date</span><span>${shortDate(rx.created_at)}</span></div>
     ${doctor ? `<div class="row"><span class="muted">Prescriber</span><span>${doctor}</span></div>` : ''}
     <table><tr><th>Drug</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Notes</th></tr>${rows}</table>
     ${rx.advice ? `<p class="muted" style="margin-top:18px"><b>Advice:</b> ${rx.advice}</p>` : ''}
     ${rx.follow_up_date ? `<p class="muted"><b>Follow-up:</b> ${shortDate(rx.follow_up_date)}</p>` : ''}`,
  );
}

function invoiceHtml(patient: Patient, bill: Bill): string {
  return shell(
    `Invoice ${bill.invoice_no ?? ''}`,
    `<div class="row"><span class="muted">Patient</span><span class="b">${patient.full_name}</span></div>
     <div class="row"><span class="muted">Date</span><span>${shortDate(bill.created_at)}</span></div>
     <div class="row"><span class="muted">Status</span><span class="pill">${bill.status}</span></div>
     <table>
       <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
       <tr><td>Consultation fee</td><td style="text-align:right">${rs(bill.consultation_fee)}</td></tr>
       <tr><td>Test fee</td><td style="text-align:right">${rs(bill.test_fee)}</td></tr>
       ${bill.discount ? `<tr><td>Discount</td><td style="text-align:right">- ${rs(bill.discount)}</td></tr>` : ''}
       <tr><td class="b">Total</td><td class="b" style="text-align:right">${rs(bill.total_amount)}</td></tr>
       <tr><td>Paid</td><td style="text-align:right">${rs(bill.amount_paid)}</td></tr>
       <tr><td class="b">Due</td><td class="b" style="text-align:right">${rs(bill.total_amount - bill.amount_paid)}</td></tr>
     </table>`,
  );
}

async function printOrShare(html: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } else {
    await Print.printAsync({ html });
  }
}

export const sharePrescriptionPdf = (patient: Patient, rx: Prescription, doctor?: string) =>
  printOrShare(rxHtml(patient, rx, doctor));

export const shareInvoicePdf = (patient: Patient, bill: Bill) =>
  printOrShare(invoiceHtml(patient, bill));
