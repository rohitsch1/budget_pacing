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
import type { Emi, Entry, Goal, Profile, Weekday } from './types';

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

/** Cycle for a profile: monthly from `payday`, or weekly / fortnightly from `payAnchor`. */
export function cycleOf(p: Profile, date: ISODate = todayISO()): Cycle {
  const freq = p.payFrequency ?? 'monthly';
  if (freq === 'monthly' || !p.payAnchor) return cycleFor(date, p.payday || 1);
  const len = freq === 'weekly' ? 7 : 14;
  const diff = daysBetweenInclusive(p.payAnchor, date) - 1; // days from anchor to date (may be negative)
  const k = Math.floor(diff / len);
  const start = addDays(p.payAnchor, k * len);
  const end = addDays(start, len - 1);
  return { start, end, days: len };
}

/** Next payday after `date` (the day after the current cycle ends). */
export function nextPayday(p: Profile, date: ISODate = todayISO()): ISODate {
  return addDays(cycleOf(p, date).end, 1);
}

// ---------- plan totals ----------
const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + (Number(x.amount) || 0), 0);

/** EMIs still running on `date` (endDate unset, or on/after date). */
export function activeEmis(p: Profile, date: ISODate = todayISO()): Emi[] {
  return p.emis.filter((e) => !e.endDate || e.endDate >= date.slice(0, 7) + '-01');
}

/** Whole months from `from` to `to` (at least 1). */
export function monthsUntil(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 1 : 0);
  return Math.max(1, m);
}

/** Monthly amount Pace sets aside for a goal so it's ready by its target date. */
export function goalMonthly(g: Goal, date: ISODate = todayISO()): number {
  const left = Math.max(0, (Number(g.amount) || 0) - (Number(g.saved) || 0));
  if (left <= 0) return 0;
  if (g.targetDate <= date) return left;
  return Math.ceil(left / monthsUntil(date, g.targetDate));
}

/** Months between today and an EMI end date, for "N months left" copy. null if unknown. */
export function emiMonthsLeft(e: Emi, date: ISODate = todayISO()): number | null {
  if (!e.endDate) return e.monthsLeft ?? null;
  if (e.endDate < date) return 0;
  return monthsUntil(date, e.endDate);
}

/** Monthly totals. Irregular income plans on a lower, typical month (irregularFactor, default 85%). */
export function planTotals(p: Profile, date: ISODate = todayISO()) {
  const incomeEntered = sum(p.incomes);
  const factor = p.irregularIncome ? (p.irregularFactor ?? 0.85) : 1;
  const income = Math.round(incomeEntered * factor);
  const bills = sum(p.bills);
  const emis = sum(activeEmis(p, date));
  const routine = p.routineMonthly || 0;
  const savings = p.savingsMonthly || 0;
  const goals = (p.goals ?? []).reduce((a, g) => a + goalMonthly(g, date), 0);
  const flexible = income - bills - emis - routine - savings - goals;
  return { income, incomeEntered, irregularBuffer: incomeEntered - income, bills, emis, routine, savings, goals, flexible };
}

/** Flexible money for one cycle: the monthly figure, scaled for weekly / fortnightly pay. */
export function cycleFlexible(p: Profile, cycle: Cycle, date: ISODate = todayISO()): number {
  const f = planTotals(p, date).flexible;
  if ((p.payFrequency ?? 'monthly') === 'monthly') return f;
  return Math.round((f * 12 * cycle.days) / 365);
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
  const cycle = cycleOf(p, date);
  const full = cycleFlexible(p, cycle, date);

  let base = full;
  let countFrom = cycle.start;
  if (p.start && p.start.date >= cycle.start && p.start.date <= cycle.end && p.start.date <= date) {
    // auto (joined mid-cycle): the remaining days' share of the *current* plan, so later plan edits still apply.
    base = p.start.auto
      ? Math.round((full * daysBetweenInclusive(p.start.date, cycle.end)) / cycle.days)
      : p.start.flexibleLeft;
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
  const cycle = cycleOf(p, today);
  if (today <= cycle.start) return p;
  const left = daysBetweenInclusive(today, cycle.end);
  return { ...p, start: { date: today, flexibleLeft: Math.round((cycleFlexible(p, cycle, today) * left) / cycle.days), auto: true } };
}

/** Expense categories: built-in plus the user's own. */
export const BUILTIN_CATEGORIES = ['Food', 'Transport', 'Groceries', 'Shopping', 'Fun', 'Health', 'Bills', 'Other'] as const;
export function categoriesFor(p: Profile): string[] {
  const seen = new Set<string>(BUILTIN_CATEGORIES.map((c) => c.toLowerCase()));
  const extra = (p.customCategories ?? []).filter((c) => {
    const k = c.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const base = BUILTIN_CATEGORIES.filter((c) => c !== 'Other');
  return [...base, ...extra, 'Other'];
}
