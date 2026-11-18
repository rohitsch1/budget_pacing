/** Pure helpers + typical amounts used by the onboarding screens. */
import { activeEmis, addDays, cycleOf, isWorkDay, MONTH_SHORT, nextDue, nextPayday, parseISODate, planTotals, prettyDate, todayISO, toISODate, weekdayOf } from '@/domain/budget';
import { SYMBOL, fmt } from '@/domain/money';
import type { CurrencyCode, Emi, Profile, Region, Weekday } from '@/domain/types';

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "On the 3rd" / "On the last day" */
export function onThe(day: number): string {
  return day >= 31 ? 'On the last day' : `On the ${ordinal(day)}`;
}

/** Amount without the currency symbol, e.g. "1,00,000" */
export function fmtBare(value: number, currency: CurrencyCode): string {
  return fmt(value, currency, { decimals: false }).slice(SYMBOL[currency].length);
}

export const sumAmounts = (xs: { amount: number }[]) => xs.reduce((a, x) => a + (Number(x.amount) || 0), 0);

/** Scale INR-ish typical amounts for other currencies (rough). */
export function typical(inr: number, region: Region): number {
  if (region === 'IN') return inr;
  const v = inr / 6.5; // very rough purchasing-power style scaling for presets only
  if (v >= 100) return Math.round(v / 10) * 10;
  return Math.max(5, Math.round(v / 5) * 5);
}

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  INR: 'Indian rupee (₹)',
  USD: 'US dollar ($)',
  EUR: 'Euro (€)',
  GBP: 'Pound (£)',
  AED: 'UAE dirham (AED)',
  SGD: 'Singapore dollar (S$)',
  CAD: 'Canadian dollar (C$)',
  AUD: 'Australian dollar (A$)',
};

export const CURRENCY_WORD: Record<CurrencyCode, string> = {
  INR: 'rupees',
  USD: 'dollars',
  EUR: 'euros',
  GBP: 'pounds',
  AED: 'dirhams',
  SGD: 'Singapore dollars',
  CAD: 'Canadian dollars',
  AUD: 'Australian dollars',
};

export interface CountryInfo {
  code: string;
  name: string;
  region: Region;
  date: string; // sample date format
  apps: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'IN', name: 'India', region: 'IN', date: '15/11/2026', apps: 'UPI apps, Paytm' },
  { code: 'US', name: 'United States', region: 'US', date: '11/15/2026', apps: 'Venmo, Cash App, PayPal' },
  { code: 'GB', name: 'United Kingdom', region: 'OTHER', date: '15/11/2026', apps: 'Banking apps, PayPal' },
  { code: 'AE', name: 'United Arab Emirates', region: 'OTHER', date: '15/11/2026', apps: 'Banking apps, Apple Pay' },
  { code: 'SG', name: 'Singapore', region: 'OTHER', date: '15/11/2026', apps: 'PayNow, PayLah!, GrabPay' },
  { code: 'CA', name: 'Canada', region: 'OTHER', date: '2026-11-15', apps: 'Interac, PayPal' },
  { code: 'AU', name: 'Australia', region: 'OTHER', date: '15/11/2026', apps: 'PayID, PayPal' },
  { code: 'DE', name: 'Germany', region: 'OTHER', date: '15.11.2026', apps: 'Banking apps, PayPal' },
  { code: 'FR', name: 'France', region: 'OTHER', date: '15/11/2026', apps: 'Banking apps, Lydia, PayPal' },
  { code: 'NL', name: 'Netherlands', region: 'OTHER', date: '15-11-2026', apps: 'Tikkie, iDEAL, PayPal' },
  { code: 'IE', name: 'Ireland', region: 'OTHER', date: '15/11/2026', apps: 'Revolut, banking apps' },
];

/** Count work days / days off in a date range (inclusive). */
export function countDays(p: Profile, from: string, to: string) {
  let work = 0;
  let off = 0;
  const perWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isWorkDay(p, d)) work++;
    else off++;
    perWeekday[weekdayOf(d)]++;
  }
  return { work, off, perWeekday };
}

/** Current pay cycle and how its days split. */
export function cycleInfo(p: Profile, date = todayISO()) {
  const cycle = cycleOf(p, date);
  return { cycle, ...countDays(p, cycle.start, cycle.end) };
}

/** Default "usual day" costs if the user hasn't said. */
export function defaultUsual(region: Region) {
  return { work: typical(625, region), off: typical(1000, region) };
}

/** Bills + EMIs still due from today until the end of the cycle. */
export function stillDueThisCycle(p: Profile, date = todayISO()): number {
  const { end } = cycleOf(p, date);
  return [...p.bills, ...activeEmis(p, date)].filter((x) => nextDue(x.dueDay, date) <= end).reduce((a, x) => a + x.amount, 0);
}

export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function describeWorkDays(days: Weekday[]): string {
  const set = new Set(days);
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d as Weekday))) return 'Mon–Fri';
  if (set.size === 6 && [1, 2, 3, 4, 5, 6].every((d) => set.has(d as Weekday))) return 'Mon–Sat';
  if (set.size === 0) return 'no fixed work days';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return WEEK_ORDER.filter((d) => set.has(d)).map((d) => names[d]).join(', ');
}

export { planTotals };

/** "Monthly", "Every 2 weeks", "Weekly" */
export function frequencyLabel(p: Profile): string {
  const f = p.payFrequency ?? 'monthly';
  return f === 'weekly' ? 'Weekly' : f === 'fortnightly' ? 'Every 2 weeks' : 'Monthly';
}

/** "Every 2 weeks · next Fri 27 Nov" / "Monthly · on the 1st · next Tue 1 Dec" */
export function paydaySummary(p: Profile, date = todayISO()): string {
  const f = p.payFrequency ?? 'monthly';
  const next = prettyDate(nextPayday(p, date));
  if (f === 'monthly') return `Monthly · ${onThe(p.payday).toLowerCase()} · next ${next}`;
  return `${frequencyLabel(p)} · next ${next}`;
}

/**
 * ISO date of the last instalment of an EMI with `monthsLeft` instalments still to pay,
 * counting from the next due date (on its due day).
 */
export function emiEndDate(dueDay: number, monthsLeft: number, from = todayISO()): string {
  const first = parseISODate(nextDue(dueDay, from));
  const y = first.getFullYear();
  const m = first.getMonth() + Math.max(1, monthsLeft) - 1;
  const last = new Date(y, m + 1, 0).getDate();
  return toISODate(new Date(y, m, Math.min(dueDay, last)));
}

/** "Ends Feb 2027" for an EMI with an end date. */
export function emiEndsLabel(e: Emi): string | null {
  if (!e.endDate) return null;
  const d = parseISODate(e.endDate);
  return `Ends ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
