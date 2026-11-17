/**
 * App state: profile + entries + onboarding draft, persisted on-device with expo-sqlite/kv-store.
 * Tiny external store (no extra deps). Use `useStore(selector)` in components and `actions.*` to mutate.
 */
import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';

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
  reminders: { morning: true, morningAt: '08:30', evening: true, eveningAt: '21:00', quietWeekends: false },
  plus: false,
};

const KEY = 'pace.state.v1';

function initial(): AppState {
  return { onboarded: false, profile: DEFAULT_PROFILE, entries: [], pending: [], seenShareHowTo: false };
}

function load(): AppState {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return { ...initial(), ...parsed, profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) } };
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
    set({ onboarded: true });
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
  /** Dev/testing: wipe everything */
  reset() {
    state = initial();
    persist();
    listeners.forEach((l) => l());
  },
};
