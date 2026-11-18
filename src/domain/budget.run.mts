// Budget engine check against the design sample. Run: node --experimental-strip-types src/domain/budget.run.mts
import { cycleOf, dayPlan, planTotals } from './budget.ts';

const p: any = {
  payday: 1, workDays: [1, 2, 3, 4, 5], incomes: [{ amount: 80000 }], bills: [{ amount: 13000 }], emis: [{ amount: 20000 }],
  routineMonthly: 12000, savingsMonthly: 10000, weekendWeight: 1.6,
  dayExtras: [{ weekday: 3, amount: 200, label: 'Badminton' }], start: null,
};
const e: any[] = [
  { kind: 'expense', amount: 13050, countsToBudget: true, at: '2026-11-10T10:00' },
  { kind: 'expense', amount: 650, countsToBudget: true, at: '2026-11-15T11:00' },
];
let fails = 0;
const check = (name: string, got: number, want: number) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got}${ok ? '' : ` (want ${want})`}`);
};
const sun = dayPlan(p, e, '2026-11-15');
check('Sunday limit', sun.limit, 973);
check('Sunday left after ₹650', sun.left, 323);
check('extras reserved', sun.extrasReserved, 400);
check('weekday share', sun.perWorkDay, 608);
const withBack = dayPlan(p, [...e, { kind: 'payback', amount: 1200, countsToBudget: true, at: '2026-11-15T21:00' }], '2026-11-15');
check('payback spread (today gains < 1200)', withBack.limit > 973 && withBack.limit < 973 + 1200 ? 1 : 0, 1);
// weekly pay: anchor Fri 2026-11-06 → cycle containing Sun 15 Nov is Fri 13 – Thu 19
const wk = cycleOf({ ...p, payFrequency: 'weekly', payAnchor: '2026-11-06' }, '2026-11-15');
check('weekly cycle start', Number(wk.start.slice(8)), 13);
check('weekly cycle days', wk.days, 7);
// fortnightly anchored in the future still works backwards
const fn = cycleOf({ ...p, payFrequency: 'fortnightly', payAnchor: '2026-12-04' }, '2026-11-15');
check('fortnightly start day', Number(fn.start.slice(8)), 6);
// auto join start follows plan edits: raising income raises the base
const auto = { ...p, start: { date: '2026-11-15', flexibleLeft: 1, auto: true } };
const a1 = dayPlan(auto, [], '2026-11-15').flexibleTotal;
const a2 = dayPlan({ ...auto, incomes: [{ amount: 110000 }] }, [], '2026-11-15').flexibleTotal;
check('auto start = 16/30 of flexible', a1, Math.round((25000 * 16) / 30));
check('auto start follows edits', a2 - a1, 16000);
// expired EMI stops counting; goals are set aside
check('expired EMI ignored', planTotals({ ...p, emis: [{ amount: 20000, endDate: '2026-10-05' }] }, '2026-11-15').emis, 0);
check('goal monthly', planTotals({ ...p, goals: [{ amount: 12000, saved: 0, targetDate: '2027-04-15' }] }, '2026-11-15').goals, 2000);
check('irregular 85%', planTotals({ ...p, irregularIncome: true }, '2026-11-15').income, 68000);
process.exit(fails ? 1 : 0);
