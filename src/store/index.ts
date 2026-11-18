/**
 * App state: profile + entries + onboarding draft, persisted on-device with expo-sqlite/kv-store.
 * Tiny external store (no extra deps). Use `useStore(selector)` in components and `actions.*` to mutate.
 */
import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';

import { toISODate, withJoinStart } from '@/domain/budget';
import type { Entry, PendingImport, Profile } from '@/domain/types';

export interface AppState {
  onboarded: boolean;
  profile: Profile;
  entries: Entry[];
  pending: PendingImport[];
  /** ids of the share-flow how-to already seen */
  seenShareHowTo: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  region: 'IN',
  country: 'India',
  currency: 'INR',
  payday: 1,
  workDays: [1, 2, 3, 4, 5],
  incomes: [],
  irregularIncome: false,
  bills: [],
  emis: [],
  routineMonthly: 0,
  routineItems: [],
  savingsMonthly: 0,
  weekendWeight: 1.6,
  dayExtras: [],
  start: null,
  payFrequency: 'monthly',
  payAnchor: null,
  savedSoFar: 0,
  debts: [],
  goals: [],
  customCategories: [],
  overAckDate: null,
  reminders: { morning: true, morningAt: '08:30', evening: true, eveningAt: '21:00', quietWeekends: false },
  plus: true, // free during early access
};

const KEY = 'pace.state.v1';

function initial(): AppState {
  return { onboarded: false, profile: DEFAULT_PROFILE, entries: [], pending: [], seenShareHowTo: false };
}

/** Fill defaults and upgrade older saved data. Also used when restoring a backup. */
export function migrate(parsed: Partial<AppState>): AppState {
  const profile: Profile = { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}), plus: true };
  // EMIs saved with a fixed "months left" get a real end date so they stop counting when paid off.
  profile.emis = (profile.emis ?? []).map((e) => {
    if (e.endDate || !e.monthsLeft) return e;
    const d = new Date();
    d.setMonth(d.getMonth() + e.monthsLeft - 1);
    return { ...e, endDate: toISODate(d) };
  });
  return {
    ...initial(),
    ...parsed,
    profile,
    entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    pending: Array.isArray(parsed.pending) ? parsed.pending : [],
  };
}

function load(): AppState {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return initial();
    return migrate(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return initial();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    Storage.setItemSync(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — keep in memory
  }
}

function set(next: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof next === 'function' ? next(state) : next;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

/** Subscribe to any state change (outside React). Returns unsubscribe. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

export function newId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const actions = {
  updateProfile(patch: Partial<Profile>) {
    set((s) => ({ profile: { ...s.profile, ...patch } }));
  },
  completeOnboarding() {
    set((s) => ({ onboarded: true, profile: withJoinStart(s.profile) }));
  },
  addEntry(e: Omit<Entry, 'id' | 'createdAt'> & { id?: string }): Entry {
    const entry: Entry = { ...e, id: e.id ?? newId('e'), createdAt: new Date().toISOString() } as Entry;
    set((s) => ({ entries: [entry, ...s.entries] }));
    return entry;
  },
  updateEntry(id: string, patch: Partial<Entry>) {
    set((s) => ({ entries: s.entries.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },
  deleteEntry(id: string) {
    set((s) => ({ entries: s.entries.filter((x) => x.id !== id) }));
  },
  addPending(p: Omit<PendingImport, 'id' | 'createdAt'>): PendingImport {
    const item: PendingImport = { ...p, id: newId('p'), createdAt: new Date().toISOString() };
    set((s) => ({ pending: [item, ...s.pending] }));
    return item;
  },
  removePending(id: string) {
    set((s) => ({ pending: s.pending.filter((x) => x.id !== id) }));
  },
  markShareHowToSeen() {
    set({ seenShareHowTo: true });
  },
  /** Replace everything with a restored backup (already parsed JSON). Throws if it isn't a Pace backup. */
  restore(data: unknown) {
    const d = data as Partial<AppState> & { app?: string };
    if (!d || typeof d !== 'object' || !d.profile || !Array.isArray(d.entries)) throw new Error('Not a Pace backup file');
    state = migrate(d);
    persist();
    listeners.forEach((l) => l());
  },
  /** Wipe everything */
  reset() {
    state = initial();
    persist();
    listeners.forEach((l) => l());
  },
};
