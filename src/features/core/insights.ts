/** Insight cards + chart data for the Insights tab (current cycle). */
import { addDays, dayPlan, daysBetweenInclusive, entryDate, isWorkDay, parseISODate, spendEffect, type DayPlan, type ISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Entry, Profile } from '@/domain/types';

import { countFrom, plannedDailyLimits, spentByDay } from './helpers';

export interface Insight {
  id: string;
  kicker: string;
  title: string;
  body?: string;
}

export interface WeekBar {
  label: string;
  spent: number;
  plan: number;
  state: 'past' | 'current' | 'future';
}

export function buildInsights(p: Profile, entries: Entry[], plan: DayPlan) {
  const cur = p.currency;
  const from = countFrom(p, plan);
  const planned = plannedDailyLimits(p, plan);
  const spent = spentByDay(entries, from, plan.cycle.end);
  const yesterday = addDays(plan.date, -1);

  // planned vs actual so far (before today)
  let plannedSoFar = 0;
  let spentSoFar = 0;
  let daysWithin = 0;
  let daysCounted = 0;
  let weekendSpent = 0;
  let weekendDays = 0;
  let workSpent = 0;
  let workDays = 0;
  for (let d = from; d <= yesterday; d = addDays(d, 1)) {
    const s = spent.get(d) ?? 0;
    plannedSoFar += planned.get(d) ?? 0;
    spentSoFar += s;
    daysCounted++;
    if (s <= dayPlan(p, entries, d).limit) daysWithin++;
    if (isWorkDay(p, d)) {
      workSpent += s;
      workDays++;
    } else {
      weekendSpent += s;
      weekendDays++;
    }
  }

  // week by week
  const weeks: WeekBar[] = [];
  let ws = plan.cycle.start;
  while (ws <= plan.cycle.end) {
    let we = addDays(ws, 6);
    // a short remainder (< 7 days) joins the last week, e.g. 22–30
    if (we >= plan.cycle.end || daysBetweenInclusive(addDays(we, 1), plan.cycle.end) < 7) we = plan.cycle.end;
    let s = 0;
    let pl = 0;
    for (let d = ws; d <= we; d = addDays(d, 1)) {
      s += spent.get(d) ?? 0;
      pl += planned.get(d) ?? 0;
    }
    weeks.push({
      label: `${parseISODate(ws).getDate()}–${parseISODate(we).getDate()}`,
      spent: s,
      plan: pl,
      state: we < plan.date ? 'past' : ws > plan.date ? 'future' : 'current',
    });
    ws = addDays(we, 1);
  }

  // categories (expenses that count, net of nothing else)
  const cats = new Map<string, number>();
  let catTotal = 0;
  const payees = new Map<string, { n: number; total: number }>();
  for (const e of entries) {
    const d = entryDate(e);
    if (d < from || d > plan.cycle.end || e.kind !== 'expense' || !e.countsToBudget) continue;
    cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
    catTotal += e.amount;
    if (e.payee) {
      const k = e.payee.trim();
      const x = payees.get(k) ?? { n: 0, total: 0 };
      payees.set(k, { n: x.n + 1, total: x.total + e.amount });
    }
  }
  const categories = Array.from(cats.entries())
    .map(([name, amount]) => ({ name, amount, pct: catTotal > 0 ? amount / catTotal : 0 }))
    .sort((a, b) => b.amount - a.amount);

  // daily spend vs limit (last up to 14 days of this cycle incl. today)
  const daily: { date: ISODate; spent: number; limit: number }[] = [];
  let start = addDays(plan.date, -13);
  if (start < from) start = from;
  for (let d = start; d <= plan.date; d = addDays(d, 1)) {
    daily.push({ date: d, spent: Math.max(0, spent.get(d) ?? 0), limit: dayPlan(p, entries, d).limit });
  }

  // ---- cards ----
  const cards: Insight[] = [];
  const hasData = entries.some((e) => {
    const d = entryDate(e);
    return d >= from && d <= plan.cycle.end && spendEffect(e) !== 0;
  });

  if (daysCounted > 0) {
    const diff = Math.round(spentSoFar - plannedSoFar);
    const startPlan = dayPlan(p, [], from);
    const before = startPlan.perWorkDay;
    const now = plan.perWorkDay;
    if (Math.abs(diff) < 1) {
      cards.push({ id: 'pace', kicker: 'WORTH KNOWING', title: `You're right on plan, so office days still get ${fmt(now, cur)}.`, body: 'Bills and savings are safe.' });
    } else if (diff > 0) {
      cards.push({
        id: 'pace',
        kicker: 'WORTH KNOWING',
        title: `You're ${fmt(diff, cur)} behind plan, so office-day limits dropped from ${fmt(before, cur)} to ${fmt(now, cur)}.`,
        body: `${fmt(spentSoFar, cur)} spent against ${fmt(plannedSoFar, cur)} planned so far. Bills and savings are still safe.`,
      });
    } else {
      cards.push({
        id: 'pace',
        kicker: 'WORTH KNOWING',
        title: `You're ${fmt(-diff, cur)} ahead of plan, so office-day limits rose from ${fmt(before, cur)} to ${fmt(now, cur)}.`,
        body: `${fmt(spentSoFar, cur)} spent against ${fmt(plannedSoFar, cur)} planned so far. Nice pacing.`,
      });
    }
  }
  if (categories.length) {
    const top = categories[0];
    cards.push({
      id: 'category',
      kicker: 'BIGGEST CATEGORY',
      title: `${top.name} is ${Math.round(top.pct * 100)}% of your spending this cycle.`,
      body: `${fmt(top.amount, cur)} so far${categories[1] ? `, then ${categories[1].name} at ${fmt(categories[1].amount, cur)}` : ''}.`,
    });
  }
  if (weekendDays > 0 && workDays > 0) {
    const we = weekendSpent / weekendDays;
    const wd = workSpent / workDays;
    cards.push({
      id: 'weekend',
      kicker: 'WEEKENDS',
      title: `A weekend day costs you about ${fmt(we, cur)}, an office day ${fmt(wd, cur)}.`,
      body: wd > 0 ? `Weekends run ${(we / wd).toFixed(1)}× office days; your plan allows ${p.weekendWeight || 1.6}×.` : undefined,
    });
  }
  if (daysCounted > 0) {
    cards.push({
      id: 'streak',
      kicker: 'WITHIN THE LIMIT',
      title: `You stayed within your daily limit on ${daysWithin} of ${daysCounted} ${daysCounted === 1 ? 'day' : 'days'}.`,
    });
  }
  const topPayee = Array.from(payees.entries()).sort((a, b) => b[1].n - a[1].n || b[1].total - a[1].total)[0];
  if (topPayee && topPayee[1].n > 1) {
    cards.push({
      id: 'payee',
      kicker: 'MOST VISITED',
      title: `You paid ${topPayee[0]} ${topPayee[1].n} times this cycle.`,
      body: `${fmt(topPayee[1].total, cur)} in total.`,
    });
  }

  return { cards, weeks, categories, catTotal, daily, hasData };
}
