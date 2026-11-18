/** Insight cards + chart data for the Insights tab (one pay cycle at a time). */
import { addDays, dayPlan, daysBetweenInclusive, entryDate, isWorkDay, parseISODate, spendEffect, type DayPlan, type ISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Entry, Profile } from '@/domain/types';

import { countFrom, plannedDailyLimits } from './helpers';

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

/**
 * @param plan  dayPlan for the reference day of the chosen cycle: today for the current cycle,
 *              the cycle's last day for a past one.
 * @param today the real today (decides which days are finished).
 */
export function buildInsights(p: Profile, entries: Entry[], plan: DayPlan, today: ISODate) {
  const cur = p.currency;
  const cycle = plan.cycle;
  const isCurrent = today >= cycle.start && today <= cycle.end;
  const from = countFrom(p, plan);
  const planned = plannedDailyLimits(p, plan);
  // last fully finished day in this cycle, and the last day shown in charts
  const lastDone = isCurrent ? addDays(today, -1) : cycle.end;
  const lastShown = isCurrent ? today : cycle.end;

  // Per day, the same thing dayPlan compares: that day's spends (counting to the budget) vs that day's limit.
  const days = new Map<ISODate, { spent: number; limit: number }>();
  const dayOf = (d: ISODate) => {
    let x = days.get(d);
    if (!x) {
      const dp = dayPlan(p, entries, d);
      x = { spent: dp.spentToday, limit: dp.limit };
      days.set(d, x);
    }
    return x;
  };

  let plannedSoFar = 0;
  let spentSoFar = 0;
  let daysWithin = 0;
  let daysCounted = 0;
  let weekendSpent = 0;
  let weekendDays = 0;
  let workSpent = 0;
  let workDays = 0;
  for (let d = from; d <= lastDone; d = addDays(d, 1)) {
    const x = dayOf(d);
    plannedSoFar += planned.get(d) ?? 0;
    spentSoFar += x.spent;
    daysCounted++;
    if (x.spent <= x.limit) daysWithin++;
    if (isWorkDay(p, d)) {
      workSpent += x.spent;
      workDays++;
    } else {
      weekendSpent += x.spent;
      weekendDays++;
    }
  }
  // current run of finished days within the limit, counting back from the last finished day
  let streak = 0;
  for (let d = lastDone; d >= from; d = addDays(d, -1)) {
    const x = dayOf(d);
    if (x.spent > x.limit) break;
    streak++;
  }

  // week by week — every bucket gets its own planned amount
  const weeks: WeekBar[] = [];
  let ws = from;
  while (ws <= cycle.end) {
    let we = addDays(ws, 6);
    // a short remainder (< 7 days) joins the last week, e.g. 22–30
    if (we >= cycle.end || daysBetweenInclusive(addDays(we, 1), cycle.end) < 7) we = cycle.end;
    let s = 0;
    let pl = 0;
    for (let d = ws; d <= we; d = addDays(d, 1)) {
      if (d <= lastShown) s += dayOf(d).spent;
      pl += planned.get(d) ?? 0;
    }
    weeks.push({
      label: `${parseISODate(ws).getDate()}–${parseISODate(we).getDate()}`,
      spent: s,
      plan: Math.round(pl),
      state: !isCurrent || we < today ? 'past' : ws > today ? 'future' : 'current',
    });
    ws = addDays(we, 1);
  }

  // categories: expenses net of the refunds linked to them; unlinked refunds only lower the net total
  const inCycle = (e: Entry) => {
    const d = entryDate(e);
    return d >= from && d <= cycle.end;
  };
  const expenseIds = new Set(entries.filter((e) => e.kind === 'expense').map((e) => e.id));
  const refundedBy = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === 'refund' && e.refundOf && expenseIds.has(e.refundOf)) refundedBy.set(e.refundOf, (refundedBy.get(e.refundOf) ?? 0) + e.amount);
  }
  const effective = (e: Entry) => Math.max(0, e.amount - (refundedBy.get(e.id) ?? 0));

  const cats = new Map<string, number>();
  let catTotal = 0;
  let unlinkedRefunds = 0;
  let outsideLimit = 0;
  let outsideCount = 0;
  const payees = new Map<string, { n: number; total: number }>();
  for (const e of entries) {
    if (!inCycle(e)) continue;
    if (e.kind === 'refund') {
      if (e.countsToBudget && !(e.refundOf && expenseIds.has(e.refundOf))) unlinkedRefunds += e.amount;
      continue;
    }
    if (e.kind !== 'expense') continue;
    if (!e.countsToBudget) {
      outsideLimit += effective(e);
      outsideCount++;
      continue;
    }
    const amt = effective(e);
    cats.set(e.category, (cats.get(e.category) ?? 0) + amt);
    catTotal += amt;
    if (e.payee) {
      const k = e.payee.trim();
      const x = payees.get(k) ?? { n: 0, total: 0 };
      payees.set(k, { n: x.n + 1, total: x.total + amt });
    }
  }
  const categories = Array.from(cats.entries())
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({ name, amount, pct: catTotal > 0 ? amount / catTotal : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const netTotal = catTotal - unlinkedRefunds;

  // daily spend vs limit (last up to 14 days shown)
  const daily: { date: ISODate; spent: number; limit: number }[] = [];
  let start = addDays(lastShown, -13);
  if (start < from) start = from;
  for (let d = start; d <= lastShown; d = addDays(d, 1)) {
    const x = dayOf(d);
    daily.push({ date: d, spent: Math.max(0, x.spent), limit: x.limit });
  }

  // ---- cards ----
  const cards: Insight[] = [];
  const hasData = entries.some((e) => inCycle(e) && (spendEffect(e) !== 0 || (e.kind === 'expense' && !e.countsToBudget)));
  const cycleWord = isCurrent ? 'this cycle' : 'that cycle';

  if (daysCounted > 0) {
    const diff = Math.round(spentSoFar - plannedSoFar);
    const before = dayPlan(p, [], from).perWorkDay;
    const now = plan.perWorkDay;
    const soFar = `${fmt(spentSoFar, cur)} spent against ${fmt(plannedSoFar, cur)} planned${isCurrent ? ' so far' : ''}.`;
    if (!isCurrent) {
      cards.push({
        id: 'pace',
        kicker: 'HOW IT WENT',
        title:
          Math.abs(diff) < 1
            ? 'You finished that cycle right on plan.'
            : diff > 0
              ? `You finished that cycle ${fmt(diff, cur)} over plan.`
              : `You finished that cycle ${fmt(-diff, cur)} under plan.`,
        body: soFar,
      });
    } else if (Math.abs(diff) < 1) {
      cards.push({ id: 'pace', kicker: 'WORTH KNOWING', title: `You're right on plan, so office days get ${fmt(now, cur)}.`, body: 'Bills and savings are safe.' });
    } else if (diff > 0) {
      cards.push({
        id: 'pace',
        kicker: 'WORTH KNOWING',
        title: `You're ${fmt(diff, cur)} behind plan, so office-day limits ${now < before ? `dropped from ${fmt(before, cur)} to ${fmt(now, cur)}` : `are ${fmt(now, cur)}`}.`,
        body: `${soFar} Bills and savings are still safe.`,
      });
    } else {
      cards.push({
        id: 'pace',
        kicker: 'WORTH KNOWING',
        title: `You're ${fmt(-diff, cur)} ahead of plan, so office-day limits ${now > before ? `rose from ${fmt(before, cur)} to ${fmt(now, cur)}` : `are ${fmt(now, cur)}`}.`,
        body: `${soFar} Nice pacing.`,
      });
    }
  }
  if (categories.length) {
    const top = categories[0];
    cards.push({
      id: 'category',
      kicker: 'BIGGEST CATEGORY',
      title: `${top.name} is ${Math.round(top.pct * 100)}% of your spending ${cycleWord}.`,
      body: `${fmt(top.amount, cur)}${isCurrent ? ' so far' : ''}${categories[1] ? `, then ${categories[1].name} at ${fmt(categories[1].amount, cur)}` : ''}.`,
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
      id: 'within',
      kicker: 'WITHIN THE LIMIT',
      title: `Within limit on ${daysWithin} of ${daysCounted} ${daysCounted === 1 ? 'day' : 'days'}.`,
      body:
        isCurrent && streak > 1
          ? `The last ${streak} days in a row were all within the limit.`
          : isCurrent && streak === 1
            ? 'Yesterday was within the limit.'
            : undefined,
    });
  }
  const topPayee = Array.from(payees.entries()).sort((a, b) => b[1].n - a[1].n || b[1].total - a[1].total)[0];
  if (topPayee && topPayee[1].n > 1) {
    cards.push({
      id: 'payee',
      kicker: 'MOST VISITED',
      title: `You paid ${topPayee[0]} ${topPayee[1].n} times ${cycleWord}.`,
      body: `${fmt(topPayee[1].total, cur)} in total.`,
    });
  }

  return { cards, weeks, categories, catTotal, netTotal, unlinkedRefunds, outsideLimit, outsideCount, daily, hasData, isCurrent };
}
