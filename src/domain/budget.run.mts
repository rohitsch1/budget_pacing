// Budget engine check against the design sample. Run: node --experimental-strip-types src/domain/budget.run.mts
import { dayPlan } from './budget.ts';

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
process.exit(fails ? 1 : 0);
