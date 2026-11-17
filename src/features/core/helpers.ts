/**
 * Core-area helpers (Today, Activity, Plan, Insights). Pure functions over the store data.
 */
import {
  addDays,
  dayPlan,
  daysBetweenInclusive,
  entryDate,
  extrasFor,
  isWorkDay,
  MONTH_SHORT,
  nextDue,
  parseISODate,
  spendEffect,
  type DayPlan,
  type ISODate,
} from '@/domain/budget';
import type { Entry, Profile } from '@/domain/types';
import { CAT } from '@/theme/tokens';

export type OnboardingEditStep =
  | 'pay'
  | 'income'
  | 'bills'
  | 'emi'
  | 'routine'
  | 'week'
  | 'savings'
  | 'start'
  | 'reminders';

/** Route object for editing one part of the plan via the onboarding screen in edit mode. */
export function editRoute(step: OnboardingEditStep) {
  return { pathname: `/onboarding/${step}` as const, params: { edit: '1' } };
}

export function catStyle(category: string) {
  return CAT[category] ?? CAT.Other;
}

/** Category tints for charts (stronger than list tints). */
export const CAT_CHART: Record<string, string> = {
  Food: '#E07A2E',
  Transport: '#2F62D8',
  Fun: '#C9457A',
  Shopping: '#8F9A2C',
  Groceries: '#1C9C8C',
  Health: '#0F6577',
  Bills: '#8A5100',
  Other: '#6C7C80',
};

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Evening';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/** "11:40" from the entry's local ISO date-time. */
export function timeOf(e: Entry): string {
  const t = e.at.slice(11, 16);
  return /^\d\d:\d\d$/.test(t) ? t : '';
}

export function entryTitle(e: Entry): string {
  if (e.kind === 'refund') return `Refund${e.payee ? ` · ${e.payee}` : ''}`;
  if (e.kind === 'payback') return `Paid back${e.payee ? ` · ${e.payee}` : ''}`;
  return e.payee || e.note || e.category || 'Expense';
}

function sourceLabel(e: Entry): string {
  if (e.source === 'screenshot' || e.source === 'share') return e.app ? `${e.app} screenshot` : 'screenshot';
  return e.method || 'manual';
}

/** "Food · 11:40 · GPay screenshot" (category optional) */
export function entryMeta(e: Entry, withCategory = true): string {
  if (e.kind !== 'expense' && e.countsToBudget) return [timeOf(e), 'Added back to budget'].filter(Boolean).join(' · ');
  const parts = [withCategory ? e.category : '', timeOf(e), sourceLabel(e)];
  if (!e.countsToBudget) parts.push('not in daily budget');
  return parts.filter(Boolean).join(' · ');
}

export function isMoneyIn(e: Entry): boolean {
  return e.kind !== 'expense';
}

export function shortDay(s: ISODate): string {
  const d = parseISODate(s);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** "18 and 25 Nov", "3, 10 and 17 Nov", "30 Nov and 1 Dec" */
export function joinDates(dates: ISODate[]): string {
  if (!dates.length) return '';
  const ds = dates.map(parseISODate);
  const sameMonth = ds.every((d) => d.getMonth() === ds[0].getMonth());
  const parts = ds.map((d, i) => (sameMonth && i < ds.length - 1 ? String(d.getDate()) : `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`));
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Where counting starts for this cycle (cycle start or the "where you stand" date). */
export function countFrom(p: Profile, plan: DayPlan): ISODate {
  const s = p.start;
  if (s && s.date >= plan.cycle.start && s.date <= plan.cycle.end && s.date <= plan.date) return s.date;
  return plan.cycle.start;
}

// ---------- bills ----------
export interface DueItem {
  id: string;
  name: string;
  amount: number;
  date: ISODate;
  kind: 'bill' | 'emi';
  monthsLeft?: number | null;
}

/** Bills + EMIs due in the cycle that contains `date`, split into upcoming (>= date) and passed. */
export function billsInCycle(p: Profile, plan: DayPlan) {
  const all: DueItem[] = [];
  const add = (x: { id: string; name: string; amount: number; dueDay: number; monthsLeft?: number | null }, kind: DueItem['kind']) => {
    // due date inside this cycle: next occurrence from cycle start
    const d = nextDue(x.dueDay, plan.cycle.start);
    if (d <= plan.cycle.end) all.push({ id: x.id, name: x.name, amount: Number(x.amount) || 0, date: d, kind, monthsLeft: x.monthsLeft });
  };
  p.bills.forEach((b) => add(b, 'bill'));
  p.emis.forEach((b) => add(b, 'emi'));
  all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const upcoming = all.filter((x) => x.date >= plan.date);
  const passed = all.filter((x) => x.date < plan.date);
  return { upcoming, passed, totalUpcoming: upcoming.reduce((a, x) => a + x.amount, 0) };
}

// ---------- per-day results ----------
export function entriesOn(entries: Entry[], date: ISODate) {
  return entries.filter((e) => entryDate(e) === date);
}

export function cycleSummary(plan: DayPlan) {
  const spent = plan.spentBefore + plan.spentToday;
  const left = plan.flexibleTotal - spent;
  const dayIndex = daysBetweenInclusive(plan.cycle.start, plan.date);
  const fraction = plan.flexibleTotal > 0 ? spent / plan.flexibleTotal : 0;
  return { spent, left, dayIndex, fraction };
}

/**
 * The "new plan" after overspending today: tomorrow's limits now vs what they would have been
 * if today had ended exactly at the limit.
 */
export function overPlan(p: Profile, entries: Entry[], plan: DayPlan) {
  const tomorrow = addDays(plan.date, 1);
  if (tomorrow > plan.cycle.end || plan.left >= 0) return null;
  const over = -plan.left;
  const t = dayPlan(p, entries, tomorrow);
  const pool = Math.max(0, t.remaining - t.extrasReserved);
  const perNow = t.sumWeights > 0 ? pool / t.sumWeights : 0;
  const perWas = t.sumWeights > 0 ? (pool + over) / t.sumWeights : 0;
  const ww = p.weekendWeight || 1.6;
  const limitOn = (d: ISODate, per: number) => Math.round(per * (isWorkDay(p, d) ? 1 : ww) + extrasFor(p, d).amount);
  const tomorrowWork = isWorkDay(p, tomorrow);
  // next day of the other kind
  let other: ISODate | null = null;
  for (let d = addDays(tomorrow, 1); d <= plan.cycle.end; d = addDays(d, 1)) {
    if (isWorkDay(p, d) !== tomorrowWork) {
      other = d;
      break;
    }
  }
  return {
    over,
    daysLeft: t.daysLeft,
    tomorrow,
    tomorrowNow: limitOn(tomorrow, perNow),
    tomorrowWas: limitOn(tomorrow, perWas),
    other,
    otherIsWork: !tomorrowWork,
    otherNow: other ? limitOn(other, perNow) : 0,
    otherWas: other ? limitOn(other, perWas) : 0,
    lessPerWorkDay: Math.round(perWas - perNow),
  };
}

// ---------- insights ----------
/** Daily limits for the cycle as originally planned (no spending), from the counting start. */
export function plannedDailyLimits(p: Profile, plan: DayPlan): Map<ISODate, number> {
  const from = countFrom(p, plan);
  const base = dayPlan(p, [], from);
  const ww = p.weekendWeight || 1.6;
  const pool = Math.max(0, base.remaining - base.extrasReserved);
  const per = base.sumWeights > 0 ? pool / base.sumWeights : 0;
  const out = new Map<ISODate, number>();
  for (let d = from; d <= plan.cycle.end; d = addDays(d, 1)) {
    out.set(d, per * (isWorkDay(p, d) ? 1 : ww) + extrasFor(p, d).amount);
  }
  return out;
}

export function spentByDay(entries: Entry[], from: ISODate, to: ISODate): Map<ISODate, number> {
  const m = new Map<ISODate, number>();
  for (const e of entries) {
    const d = entryDate(e);
    if (d < from || d > to) continue;
    m.set(d, (m.get(d) ?? 0) + spendEffect(e));
  }
  return m;
}

/** True when there is no income in the plan yet (nothing to budget from). */
export function planTotalsEmpty(p: Profile): boolean {
  return !p.incomes.some((x) => Number(x.amount) > 0) && !(p.start && p.start.flexibleLeft > 0);
}
