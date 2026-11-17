/**
 * Onboarding-only answers that the shared Profile doesn't model (work type, a "usual day" cost,
 * cash on hand…). Persisted separately so going back to a screen shows what the user said.
 */
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

export type WorkType = 'sal' | 'free' | 'self' | 'biz' | 'other';
export type CardBalance = 'full' | 'sometimes' | 'none';

export interface Debt {
  id: string;
  who: string;
  amount: number;
  /** 'owe' = I owe them, 'owed' = they owe me */
  dir: 'owe' | 'owed';
}

export interface ObDraft {
  workType: WorkType | null;
  /** what a normal work day / day off usually costs — used for the weekend weight and "breathing room" */
  usualWorkDay: number | null;
  usualDayOff: number | null;
  cardBalance: CardBalance | null;
  bank: number | null;
  cash: number | null;
  savedSoFar: number | null;
  debts: Debt[];
}

const KEY = 'pace.onboarding.draft.v1';
const EMPTY: ObDraft = {
  workType: null,
  usualWorkDay: null,
  usualDayOff: null,
  cardBalance: null,
  bank: null,
  cash: null,
  savedSoFar: null,
  debts: [],
};

function load(): ObDraft {
  try {
    const raw = Storage.getItemSync(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<ObDraft>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let draft: ObDraft = load();
const listeners = new Set<() => void>();

export function updateDraft(patch: Partial<ObDraft>) {
  draft = { ...draft, ...patch };
  try {
    Storage.setItemSync(KEY, JSON.stringify(draft));
  } catch {
    // keep in memory
  }
  listeners.forEach((l) => l());
}

export function getDraft(): ObDraft {
  return draft;
}

export function useDraft(): ObDraft {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => draft,
    () => draft,
  );
}

/** Clear onboarding-only answers (used by Settings → Delete all data). */
export function resetDraft() {
  updateDraft({ ...EMPTY, debts: [] });
}
