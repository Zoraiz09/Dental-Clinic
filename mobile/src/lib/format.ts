import dayjs from 'dayjs';

/** Pakistani Rupee formatting used across billing & earnings. */
export function rs(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function shortDate(iso?: string | null): string {
  return iso ? dayjs(iso).format('MMM D, YYYY') : '—';
}

export function dateTime(iso?: string | null): string {
  return iso ? dayjs(iso).format('MMM D · hh:mm A') : '—';
}

/** Full date + time stamp used in the expense ledger. */
export function dateTimeStamp(iso?: string | null): string {
  return iso ? dayjs(iso).format('MMM D, YYYY · hh:mm A') : '—';
}

export function age(dob?: string | null): string {
  if (!dob) return '—';
  return `${dayjs().diff(dayjs(dob), 'year')} yrs`;
}
