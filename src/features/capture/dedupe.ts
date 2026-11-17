import type { Entry } from '@/domain/types';

export interface DuplicateMatch {
  entry: Entry;
  /** human reasons, e.g. "Same amount", "Same reference number, ••7710", "Paid 1 minute apart" */
  sameRef: boolean;
  minutesApart: number | null;
}

const WINDOW_MIN = 10;

function minutesBetween(a: string, b: string): number | null {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!isFinite(ta) || !isFinite(tb)) return null;
  return Math.abs(ta - tb) / 60000;
}

function refsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const x = a.toUpperCase();
  const y = b.toUpperCase();
  const n = Math.min(x.length, y.length, 6);
  return n >= 4 && x.slice(-n) === y.slice(-n);
}

/**
 * Likely duplicate among stored entries: same transaction reference, or same amount within 10 minutes.
 * Only money-out entries are compared with money-out receipts (and money-in with money-in).
 */
export function findDuplicate(
  entries: Entry[],
  p: { amount: number | null; ref: string | null; at: string | null; incoming?: boolean },
): DuplicateMatch | null {
  const kinds = p.incoming ? ['refund', 'payback', 'income'] : ['expense'];
  let best: DuplicateMatch | null = null;
  for (const e of entries) {
    if (!kinds.includes(e.kind)) continue;
    const sameRef = refsMatch(p.ref, e.ref);
    const mins = p.at ? minutesBetween(p.at, e.at) : null;
    const sameAmount = p.amount !== null && Math.abs(e.amount - p.amount) < 0.01;
    if (sameRef && (p.amount === null || sameAmount)) return { entry: e, sameRef: true, minutesApart: mins };
    if (sameAmount && mins !== null && mins <= WINDOW_MIN) {
      if (!best || (best.minutesApart ?? 99) > mins) best = { entry: e, sameRef: false, minutesApart: mins };
    }
  }
  return best;
}
