/**
 * Pace budget engine — the "Smart Daily Spending Allowance".
 *
 * Flexible money for the cycle = income − bills − EMIs − routine − savings.
 * Each remaining day gets a share of what's left:
 *   1. Day-wise extras (e.g. Wednesday +₹200) for every remaining day are reserved first.
 *   2. The rest is split by weight: work day = 1, non-work ("weekend") day = weekendWeight (1.6).
 *   3. Today's limit = rest × weight(today) / Σweights + extra(today).
 * Overspending today simply lowers what's left, so tomorrow's limit adjusts automatically.
 *
 * Reference example (design sample data, Sun 15 Nov 2026, cycle Nov 1–30):
 *   ₹11,950 left over 16 days (5 weekend, 11 weekday), ₹400 reserved for 2 Wednesdays.
 *   ₹11,550 / (5×1.6 + 11) = ₹607.9 → weekday ₹608, weekend ₹973, Wednesday ₹808.
 */
import type { Entry, Profile, Weekday } from './types';

// ---------- date helpers (local, yyyy-mm-dd) ----------
export type ISODate = string;

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
export function daysBetweenInclusive(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86400000) + 1;
}
export function weekdayOf(s: ISODate): Weekday {
  return parseISODate(s).getDay() as Weekday;
}
function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}
function clampDay(y: number, m0: number, day: number): Date {
  return new Date(y, m0, Math.min(day, daysInMonth(y, m0)));
}
export function todayISO(): ISODate {
  return toISODate(new Date());
}

// ---------- cycle ----------
export interface Cycle {
  start: ISODate;
  end: ISODate; // inclusive
  days: number;
}

export function cycleFor(date: ISODate, payday: number): Cycle {
  const d = parseISODate(date);
  let y = d.getFullYear();
  let m = d.getMonth();
  const thisPay = clampDay(y, m, payday);
  let start: Date;
  if (d >= thisPay) start = thisPay;
  else {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
    start = clampDay(y, m, payday);
  }
  const nm = start.getMonth() + 1;
  const ny = start.getFullYear() + (nm > 11 ? 1 : 0);
  const next = clampDay(ny, nm % 12, payday);
  next.setDate(next.getDate() - 1);
  const s = toISODate(start);
  const e = toISODate(next);
  return { start: s, end: e, days: daysBetweenInclusive(s, e) };
}

// ---------- plan totals ----------
const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + (Number(x.amount) || 0), 0);

export function planTotals(p: Profile) {
  const income = sum(p.incomes);
  const bills = sum(p.bills);
  const emis = sum(p.emis);
  const routine = p.routineMonthly || 0;
  const savings = p.savingsMonthly || 0;
  const flexible = income - bills - emis - routine - savings;
  return { income, bills, emis, routine, savings, flexible };
}

// ---------- entries ----------
/** Signed effect of an entry on flexible money: spending is +, money back is −. */
export function spendEffect(e: Entry): number {
  if (!e.countsToBudget) return 0;
  switch (e.kind) {
    case 'expense': return e.amount;
    case 'refund':
    case 'payback':
    case 'income': return -e.amount;
  }
}

export function entryDate(e: Entry): ISODate {
  return e.at.slice(0, 10);
}

// ---------- the daily allowance ----------
export interface DayPlan {
  date: ISODate;
  cycle: Cycle;
  flexibleTotal: number; // plan flexible for the cycle (or start override)
  spentBefore: number; // net spent in cycle before today
  remaining: number; // flexible left at start of today
  daysLeft: number; // incl. today
  weekendDaysLeft: number;
  workDaysLeft: number;
  extrasReserved: number; // all extras for today..end
  extraToday: number;
  extraTodayLabel: string | null;
  weightToday: number;
  sumWeights: number;
  perWorkDay: number;
  perWeekendDay: number;
  limit: number; // today's limit (rounded)
  spentToday: number; // net spent today
  left: number; // limit − spentToday (can be negative)
  status: 'ok' | 'tight' | 'over';
  /** future extras, for "₹400 set aside for 2 Wednesdays" copy */
  upcomingExtras: { date: ISODate; amount: number; label: string }[];
}

export function isWorkDay(p: Profile, d: ISODate): boolean {
  return p.workDays.includes(weekdayOf(d));
}

export function extrasFor(p: Profile, d: ISODate): { amount: number; label: string | null } {
  const wd = weekdayOf(d);
  const xs = p.dayExtras.filter((x) => x.weekday === wd);
  if (!xs.length) return { amount: 0, label: null };
  return { amount: sum(xs), label: xs.map((x) => x.label).join(' + ') };
}

export function dayPlan(p: Profile, entries: Entry[], date: ISODate = todayISO()): DayPlan {
  const cycle = cycleFor(date, p.payday || 1);
  const totals = planTotals(p);

  let base = totals.flexible;
  let countFrom = cycle.start;
  if (p.start && p.start.date >= cycle.start && p.start.date <= cycle.end && p.start.date <= date) {
    base = p.start.flexibleLeft;
    countFrom = p.start.date;
  }

  let spentBefore = 0;
  let spentToday = 0;
  for (const e of entries) {
    const d = entryDate(e);
    if (d < countFrom || d > cycle.end) continue;
    const eff = spendEffect(e);
    // Money coming back today (payback/refund/income) is spread over all remaining days, not just today.
    if (d < date || (d === date && eff < 0)) spentBefore += eff;
    else if (d === date) spentToday += eff;
  }

  const remaining = base - spentBefore;
  const ww = p.weekendWeight || 1.6;
  let sumWeights = 0;
  let extrasReserved = 0;
  let weekendDaysLeft = 0;
  let workDaysLeft = 0;
  const upcomingExtras: DayPlan['upcomingExtras'] = [];
  for (let d = date; d <= cycle.end; d = addDays(d, 1)) {
    const work = isWorkDay(p, d);
    if (work) workDaysLeft++; else weekendDaysLeft++;
    sumWeights += work ? 1 : ww;
    const x = extrasFor(p, d);
    extrasReserved += x.amount;
    if (x.amount && d !== date) upcomingExtras.push({ date: d, amount: x.amount, label: x.label ?? '' });
  }
  const pool = Math.max(0, remaining - extrasReserved);
  const perUnit = sumWeights > 0 ? pool / sumWeights : 0;
  const weightToday = isWorkDay(p, date) ? 1 : ww;
  const xt = extrasFor(p, date);
  const limit = Math.max(0, Math.round(perUnit * weightToday + xt.amount));
  const left = limit - spentToday;
  const status: DayPlan['status'] = left < 0 ? 'over' : left < limit * 0.2 ? 'tight' : 'ok';

  return {
    date, cycle, flexibleTotal: base, spentBefore, remaining,
    daysLeft: daysBetweenInclusive(date, cycle.end), weekendDaysLeft, workDaysLeft,
    extrasReserved, extraToday: xt.amount, extraTodayLabel: xt.label,
    weightToday, sumWeights, perWorkDay: Math.round(perUnit), perWeekendDay: Math.round(perUnit * ww),
    limit, spentToday, left, status, upcomingExtras,
  };
}

/** Limit for each remaining day assuming nothing more is spent (for week strips). */
export function projectedLimits(p: Profile, entries: Entry[], date: ISODate = todayISO(), count = 7) {
  const plan = dayPlan(p, entries, date);
  const out: { date: ISODate; limit: number; work: boolean; extra: number }[] = [];
  for (let i = 0; i < count; i++) {
    const d = addDays(date, i);
    if (d > plan.cycle.end) break;
    const work = isWorkDay(p, d);
    const x = extrasFor(p, d).amount;
    out.push({ date: d, work, extra: x, limit: i === 0 ? plan.limit : Math.round((work ? plan.perWorkDay : plan.perWeekendDay) + x) });
  }
  return out;
}

/** Next due date (>= from) for a monthly recurring item. */
export function nextDue(dueDay: number, from: ISODate): ISODate {
  const d = parseISODate(from);
  let c = clampDay(d.getFullYear(), d.getMonth(), dueDay);
  if (c < d) c = clampDay(d.getFullYear(), d.getMonth() + 1, dueDay);
  return toISODate(c);
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export function prettyDate(s: ISODate): string {
  const d = parseISODate(s);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/**
 * Joining part-way through a pay cycle without saying what's left: assume the flexible money is
 * spread evenly over the cycle, so only the remaining days' share is still available from today.
 */
export function withJoinStart(p: Profile, today: ISODate = todayISO()): Profile {
  if (p.start) return p;
  const cycle = cycleFor(today, p.payday || 1);
  if (today <= cycle.start) return p;
  const left = daysBetweenInclusive(today, cycle.end);
  return { ...p, start: { date: today, flexibleLeft: Math.round((planTotals(p).flexible * left) / cycle.days) } };
}
