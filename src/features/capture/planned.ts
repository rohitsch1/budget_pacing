/**
 * "Already in my plan": bills and EMIs are taken out of the flexible budget up front, so paying them
 * must not count toward the daily limit a second time. This finds the planned item a payment matches.
 */
import { activeEmis } from '@/domain/budget';
import type { Profile } from '@/domain/types';

export interface PlannedMatch {
  id: string;
  name: string;
  amount: number;
  kind: 'bill' | 'emi';
  /** the payee (or the category) also points at this item, not just the amount */
  strong: boolean;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

function namesMatch(payee: string | null | undefined, name: string): boolean {
  if (!payee) return false;
  const a = words(payee);
  const b = words(name);
  return a.some((w) => b.includes(w)) || payee.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(payee.toLowerCase());
}

/** Bill / active EMI whose amount is within ±2% of `amount` (closest wins; a name match wins over amount-only). */
export function matchPlanned(p: Profile, amount: number, payee?: string | null): PlannedMatch | null {
  if (!amount || amount <= 0) return null;
  const items: PlannedMatch[] = [
    ...p.bills.map((b) => ({ id: b.id, name: b.name, amount: Number(b.amount) || 0, kind: 'bill' as const, strong: false })),
    ...activeEmis(p).map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) || 0, kind: 'emi' as const, strong: false })),
  ];
  let best: PlannedMatch | null = null;
  let bestScore = Infinity;
  for (const it of items) {
    if (it.amount <= 0) continue;
    const diff = Math.abs(it.amount - amount) / it.amount;
    if (diff > 0.02) continue;
    const strong = namesMatch(payee, it.name);
    const score = diff - (strong ? 1 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { ...it, strong };
    }
  }
  return best;
}

/** Should the "Already in my plan (bill/EMI)" toggle default to ON? */
export function suggestPlanned(p: Profile, amount: number, payee: string | null | undefined, category: string): boolean {
  return category === 'Bills' || !!matchPlanned(p, amount, payee);
}
