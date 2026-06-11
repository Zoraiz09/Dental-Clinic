import dayjs, { Dayjs } from 'dayjs';

/**
 * Pure, framework-free helpers for the date-bucketed aggregations the
 * dashboards render (KPIs, trend bars, earnings series).
 *
 * Why this module exists:
 *  1. **Correct "today".** Several screens captured `const NOW = dayjs()`
 *     at *module load*. That value is frozen for the lifetime of the JS
 *     bundle, so an app left open past midnight (or resumed the next day)
 *     reports the wrong day. `clinicNow()` is a function, so callers get a
 *     fresh value on each render.
 *  2. **One implementation.** The "last 7 days" bar series and the
 *     "is this from today" filter were copy-pasted across Home, Reports,
 *     Earnings and Schedule with subtle drift. They now share these.
 */
export const clinicNow = (): Dayjs => dayjs();

/** True when ISO timestamp `iso` falls on the same calendar day as `ref`. */
export function isSameDay(iso?: string | null, ref: Dayjs = clinicNow()): boolean {
  return !!iso && dayjs(iso).isSame(ref, 'day');
}

/**
 * The last `n` days as dayjs objects, oldest → newest, ending today.
 * `lastNDays(7)` ⇒ [6 days ago … today].
 */
export function lastNDays(n: number, now: Dayjs = clinicNow()): Dayjs[] {
  return Array.from({ length: n }, (_, i) => now.subtract(n - 1 - i, 'day'));
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Sum `getValue(item)` into one bar per day, for items whose `getDate(item)`
 * lands on that day. Labels use the single-letter weekday (e.g. "M").
 *
 * Reproduces the exact series previously hand-rolled in Reports and Earnings:
 *   dailySeries(bills, b => b.created_at, b => b.total_amount)
 */
export function dailySeries<T>(
  items: T[],
  getDate: (item: T) => string,
  getValue: (item: T) => number,
  days: Dayjs[] = lastNDays(7),
): SeriesPoint[] {
  return days.map((d) => ({
    label: d.format('dd')[0],
    value: items
      .filter((it) => dayjs(getDate(it)).isSame(d, 'day'))
      .reduce((sum, it) => sum + getValue(it), 0),
  }));
}
