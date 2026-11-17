export type Region = 'IN' | 'US' | 'OTHER';
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD' | 'CAD' | 'AUD';

/** Weekday index like Date.getDay(): 0 = Sunday … 6 = Saturday */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Recurring {
  id: string;
  name: string;
  amount: number;
  /** day of month it is due (1-31). Clamped to month length. */
  dueDay: number;
}

export interface Emi extends Recurring {
  /** optional: months left (null = unknown) */
  monthsLeft?: number | null;
}

export interface DayExtra {
  id: string;
  weekday: Weekday;
  amount: number;
  label: string; // e.g. "Badminton"
}

export interface Profile {
  name: string;
  feeling?: string; // how money feels (onboarding chapter 1)
  region: Region;
  country: string; // display name, e.g. "India"
  currency: CurrencyCode;
  /** day of month salary arrives; cycle runs payday → day before next payday */
  payday: number;
  /** days the user goes to work (weekday indexes). Non-work days are "weekend" days. */
  workDays: Weekday[];
  incomes: Recurring[]; // salary + others (dueDay = day it arrives)
  irregularIncome: boolean;
  bills: Recurring[]; // rent, utilities, subscriptions
  emis: Emi[];
  routineMonthly: number; // groceries, fuel, etc. planned per month
  routineItems: { id: string; name: string; amount: number }[];
  savingsMonthly: number;
  /** weekend (non-work day) weight vs a work day. Default 1.6 */
  weekendWeight: number;
  dayExtras: DayExtra[];
  /**
   * Optional "where you stand today" override: money left for flexible spending
   * for the rest of the current cycle, as of `startDate` (ISO yyyy-mm-dd).
   */
  start?: { date: string; flexibleLeft: number } | null;
  reminders: { morning: boolean; morningAt: string; evening: boolean; eveningAt: string; quietWeekends: boolean };
  plus: boolean; // Pace Plus (premium) — UI only for now
}

export type EntryKind = 'expense' | 'refund' | 'payback' | 'income';
export type EntrySource = 'manual' | 'share' | 'screenshot';

export interface Entry {
  id: string;
  kind: EntryKind;
  amount: number; // always positive; kind decides the sign
  currency: CurrencyCode;
  category: string; // one of CATEGORIES (expense) or 'Income'
  payee?: string;
  note?: string;
  method?: string; // "UPI · HDFC ••4421", "Cash", "Card"
  methodTag?: 'Bank' | 'Credit' | 'Debit' | 'Wallet' | 'Cash';
  ref?: string; // transaction reference (UPI ref / UTR / app id), last 4+ digits
  app?: string; // detected payment app (Google Pay, PhonePe, Venmo…)
  source: EntrySource;
  /** local date-time ISO string of when the payment happened */
  at: string;
  createdAt: string;
  /** false for planned bills/EMIs paid through Pace — they are already outside the flexible budget */
  countsToBudget: boolean;
}

/** Pending import waiting for user OK (from share sheet or screenshot) */
export interface PendingImport {
  id: string;
  imageUri?: string;
  text?: string;
  createdAt: string;
}
