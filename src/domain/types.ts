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
  /** optional: months left when last edited (null = unknown). Prefer `endDate`. */
  monthsLeft?: number | null;
  /** ISO yyyy-mm-dd of the last instalment; after this the EMI stops counting. */
  endDate?: string | null;
}

export type PayFrequency = 'monthly' | 'weekly' | 'fortnightly';

/** Money the user owes someone (owe) or is owed (owed). Settling creates an Entry. */
export interface Debt {
  id: string;
  label: string;
  amount: number;
  dir: 'owe' | 'owed';
}

/** A planned purchase / savings goal. Pace sets aside amount/monthsLeft each month until targetDate. */
export interface Goal {
  id: string;
  name: string;
  amount: number;
  /** ISO yyyy-mm-dd */
  targetDate: string;
  /** already put aside for this goal */
  saved: number;
  createdAt: string;
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
  /** day of month salary arrives; cycle runs payday → day before next payday (monthly) */
  payday: number;
  /** how often pay arrives. Weekly/fortnightly cycles start on `payAnchor` and repeat every 7/14 days. Default monthly. */
  payFrequency?: PayFrequency;
  /** ISO date of any past/next payday, used for weekly/fortnightly cycles */
  payAnchor?: string | null;
  /** days the user goes to work (weekday indexes). Non-work days are "weekend" days. */
  workDays: Weekday[];
  incomes: Recurring[]; // salary + others (dueDay = day it arrives)
  irregularIncome: boolean;
  /** when irregularIncome: plan on this share of the entered income (default 0.85 = a lower, typical month) */
  irregularFactor?: number;
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
  start?: { date: string; flexibleLeft: number; auto?: boolean } | null;
  /** savings the user already has (onboarding "where you stand") */
  savedSoFar?: number;
  debts?: Debt[];
  goals?: Goal[];
  /** user-added expense categories, on top of the built-in ones */
  customCategories?: string[];
  /** date (yyyy-mm-dd) the user acknowledged an overspend on Today */
  overAckDate?: string | null;
  reminders: { morning: boolean; morningAt: string; evening: boolean; eveningAt: string; quietWeekends: boolean };
  plus: boolean; // Pace Plus — free for everyone during early access (no billing yet)
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
  /** for kind 'refund': id of the expense this refund belongs to */
  refundOf?: string;
}

/** Pending import waiting for user OK (from share sheet or screenshot) */
export interface PendingImport {
  id: string;
  source?: EntrySource;
  imageUri?: string;
  text?: string;
  createdAt: string;
}
