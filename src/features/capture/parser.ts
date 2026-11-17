/**
 * Receipt reader: turns OCR lines (or shared text) from ANY payment app into a structured payment.
 *
 * Pure TypeScript — no React Native imports — so it can be tested with plain Node:
 *   node --experimental-strip-types src/features/capture/parser.run.mjs
 *
 * Strategy: general rules first (currency, status words, payee after "to"/"from", dates, references),
 * then light per-app tuning once the app name is detected in the text.
 */
import type { CurrencyCode } from '@/domain/types';

export type Direction = 'out' | 'in' | 'failed' | 'pending' | 'unknown';
export type MethodTag = 'Bank' | 'Credit' | 'Debit' | 'Wallet';

export interface ParsedReceipt {
  amount: number | null;
  currency: CurrencyCode;
  direction: Direction;
  /** counterparty: who was paid (out) or who paid you (in) */
  payee: string | null;
  /** local date-time ISO (yyyy-mm-ddTHH:mm:00), no timezone */
  at: string | null;
  /** last 4–6 characters of the transaction reference */
  ref: string | null;
  app: string | null;
  method: string | null;
  methodTag: MethodTag | null;
  note: string | null;
  /** suggested spending category (Food, Transport…) or null */
  category: string | null;
  confidence: number;
  /** short human chips of what was read, for the "what we did find" fallback */
  found: string[];
}

export interface ParseOptions {
  homeCurrency?: CurrencyCode;
  now?: Date;
}

// ---------------------------------------------------------------------------
// Known apps & banks
// ---------------------------------------------------------------------------
interface AppDef {
  name: string;
  re: RegExp;
  region: 'IN' | 'US';
}
const APPS: AppDef[] = [
  { name: 'Kiwi', re: /\bkiwi\b/i, region: 'IN' },
  { name: 'Google Pay', re: /\bgoogle\s*pay\b|\bg\s?pay\b|google transaction id/i, region: 'IN' },
  { name: 'PhonePe', re: /\bphone\s?pe\b/i, region: 'IN' },
  { name: 'Paytm', re: /\bpaytm\b/i, region: 'IN' },
  { name: 'BHIM', re: /\bbhim\b/i, region: 'IN' },
  { name: 'CRED', re: /\bcred\b(?!it)/i, region: 'IN' },
  { name: 'Amazon Pay', re: /\bamazon\s*pay\b/i, region: 'IN' },
  { name: 'WhatsApp Pay', re: /\bwhats\s?app\b/i, region: 'IN' },
  { name: 'Venmo', re: /\bvenmo\b/i, region: 'US' },
  { name: 'Cash App', re: /\bcash\s?app\b/i, region: 'US' },
  { name: 'PayPal', re: /\bpay\s?pal\b/i, region: 'US' },
  { name: 'Zelle', re: /\bzelle\b/i, region: 'US' },
  { name: 'Apple Pay', re: /\bapple\s*(?:pay|cash)\b/i, region: 'US' },
  { name: 'Google Wallet', re: /\bgoogle\s*wallet\b/i, region: 'US' },
  { name: 'Chime', re: /\bchime\b/i, region: 'US' },
];

interface BankDef {
  name: string;
  re: RegExp;
  region: 'IN' | 'US';
}
const BANKS: BankDef[] = [
  { name: 'HDFC Bank', re: /\bhdfc\b/i, region: 'IN' },
  { name: 'ICICI Bank', re: /\bicici\b/i, region: 'IN' },
  { name: 'SBI', re: /\bsbi\b|state bank of india/i, region: 'IN' },
  { name: 'Axis Bank', re: /\baxis\s*bank\b/i, region: 'IN' },
  { name: 'Kotak', re: /\bkotak\b/i, region: 'IN' },
  { name: 'Yes Bank', re: /\byes\s*bank\b/i, region: 'IN' },
  { name: 'IDFC First', re: /\bidfc\b/i, region: 'IN' },
  { name: 'IndusInd', re: /\bindusind\b/i, region: 'IN' },
  { name: 'PNB', re: /\bpnb\b|punjab national/i, region: 'IN' },
  { name: 'Bank of Baroda', re: /bank of baroda|\bbob\b/i, region: 'IN' },
  { name: 'Canara Bank', re: /\bcanara\b/i, region: 'IN' },
  { name: 'Federal Bank', re: /\bfederal\s*bank\b/i, region: 'IN' },
  { name: 'Union Bank', re: /\bunion\s*bank\b/i, region: 'IN' },
  { name: 'Chase', re: /\bchase\b/i, region: 'US' },
  { name: 'Bank of America', re: /bank of america|\bbofa\b/i, region: 'US' },
  { name: 'Wells Fargo', re: /\bwells\s*fargo\b/i, region: 'US' },
  { name: 'Capital One', re: /\bcapital\s*one\b/i, region: 'US' },
  { name: 'Citi', re: /\bciti(?:bank)?\b/i, region: 'US' },
  { name: 'U.S. Bank', re: /\bu\.?s\.? bank\b/i, region: 'US' },
  { name: 'PNC', re: /\bpnc\b/i, region: 'US' },
  { name: 'TD Bank', re: /\btd bank\b/i, region: 'US' },
  { name: 'Ally', re: /\bally\s*bank\b/i, region: 'US' },
  { name: 'American Express', re: /\bamerican express\b|\bamex\b/i, region: 'US' },
  { name: 'Discover', re: /\bdiscover\b/i, region: 'US' },
];

// ---------------------------------------------------------------------------
// Category suggestion
// ---------------------------------------------------------------------------
const CATEGORY_HINTS: [string, RegExp][] = [
  ['Food', /swiggy|zomato|coffee|cafe|café|restaurant|kitchen|bistro|pizza|burger|biryani|bakery|starbucks|chai|tea|dhaba|food|domino|mcdonald|kfc|subway|doordash|grubhub|uber eats|chipotle|dinner|lunch|breakfast|brunch|blue bottle/i],
  ['Transport', /\buber\b(?! eats)|\bola\b|rapido|\blyft\b|metro|irctc|railway|petrol|diesel|fuel|\bshell\b|indian oil|\bhpcl\b|\bbpcl\b|fastag|parking|\bcab\b|\btaxi\b|auto/i],
  ['Groceries', /bigbasket|blinkit|zepto|instamart|dmart|grocer|supermarket|kirana|whole foods|trader joe|safeway|kroger|costco|reliance fresh|more retail|vegetable|fruits/i],
  ['Shopping', /amazon(?!\s*pay)|flipkart|myntra|ajio|nykaa|meesho|target|walmart|ikea|decathlon|mall|store|fashion|apparel/i],
  ['Fun', /netflix|spotify|bookmyshow|\bpvr\b|inox|cinema|movie|steam|playstation|hotstar|prime video|game|concert|bar\b|pub\b/i],
  ['Health', /pharma|apollo|medplus|1mg|netmeds|chemist|hospital|clinic|doctor|\bcvs\b|walgreens|diagnostic|lab\b|gym|fitness/i],
  ['Bills', /electricity|broadband|airtel|jio|vodafone|\bvi\b|recharge|postpaid|bescom|insurance|verizon|at&t|t-mobile|comcast|xfinity/i],
];

export function suggestCategory(...texts: (string | null | undefined)[]): string | null {
  const t = texts.filter(Boolean).join(' ');
  if (!t) return null;
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(t)) return cat;
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthIndex(s: string): number {
  const k = s.slice(0, 3).toLowerCase();
  return MONTHS.indexOf(k);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toNumber(s: string): number {
  return Number(s.replace(/[,\s]/g, ''));
}

/** Common OCR slips around money and labels. */
function normalizeLine(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\bRs\s*\.\s*/gi, 'Rs ')
    .replace(/₹\s+/g, '₹')
    .replace(/\$\s+(?=\d)/g, '$')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const CURRENCY_TOKENS: [RegExp, CurrencyCode][] = [
  [/^(₹|rs|inr)$/i, 'INR'],
  [/^(\$|usd|us\$)$/i, 'USD'],
  [/^(€|eur)$/i, 'EUR'],
  [/^(£|gbp)$/i, 'GBP'],
  [/^(aed)$/i, 'AED'],
];
function currencyOf(tok: string): CurrencyCode | null {
  for (const [re, c] of CURRENCY_TOKENS) if (re.test(tok.trim())) return c;
  return null;
}

const NUM = '(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const PREFIX_RE = new RegExp(`(₹|\\brs\\b|\\binr\\b|us\\$|\\$|\\busd\\b|€|\\beur\\b|£|\\bgbp\\b|\\baed\\b)\\s?${NUM}(?![\\d])`, 'gi');
const SUFFIX_RE = new RegExp(`(?<![\\d.,])${NUM}\\s?(₹|\\binr\\b|\\busd\\b|\\beur\\b|€|\\bgbp\\b|\\baed\\b|\\brs\\b)`, 'gi');
const BARE_NUMBER_LINE = /^[+\-−]?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{1,7}(?:\.\d{1,2})?)\s*(?:\/-)?$/;

/**
 * On-device OCR often misses the rupee sign: it drops it ("1,200"), turns it into a stray glyph
 * ("%380", "Z380") or reads it as a 7 ("7380" for ₹380). Payment apps always group amounts of
 * 1,000+ with commas, so an ungrouped "7" + 1–3 digits on its own line is a misread ₹ amount.
 * Returns the corrected number string, or null.
 */
function rupeeMisread(line: string): string | null {
  const glyph = line.match(/^[%*ZzRF₹]\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)$/);
  if (glyph) return glyph[1];
  const seven = line.match(/^7(\d{1,3})(\.\d{1,2})?$/);
  if (seven && Number(seven[1]) > 0) return seven[1] + (seven[2] ?? '');
  return null;
}

const STATUS_RE = /\b(paid|sent|received|debited|credited|successful|success|completed|transferred|refund(?:ed)?|you paid|payment|money)\b/i;
const NOISE_LINE_RE = /\b(balance|bal\b|available|avl|limit|cashback|reward|points|coins|scratch|offer|fee|charges|emi|min(?:imum)? due)\b/i;
const ID_LINE_RE = /\b(ref|utr|txn|transaction|order|upi id|id\b|a\/c|acct|account|mobile|phone|card\s*(?:no|number)|vpa)\b/i;

interface Candidate {
  value: number;
  currency: CurrencyCode | null;
  line: number;
  score: number;
}

function isYearLike(v: number, raw: string): boolean {
  return !raw.includes('.') && !raw.includes(',') && v >= 1990 && v <= 2100;
}

// ---------------------------------------------------------------------------
// Amount
// ---------------------------------------------------------------------------
function findAmount(lines: string[], statusLines: Set<number>, rupeeContext = false): Candidate | null {
  const cands: Candidate[] = [];
  const near = (i: number) => statusLines.has(i - 1) || statusLines.has(i + 1) || statusLines.has(i - 2) || statusLines.has(i + 2);

  lines.forEach((line, i) => {
    const noise = NOISE_LINE_RE.test(line);
    const idish = ID_LINE_RE.test(line) && !STATUS_RE.test(line);
    let tagged = false;
    const add = (raw: string, cur: CurrencyCode | null, base: number) => {
      const v = toNumber(raw);
      if (!isFinite(v) || v <= 0 || v >= 1e8) return;
      let score = base;
      if (statusLines.has(i)) score += 3;
      else if (near(i)) score += 1;
      if (noise) score -= 8;
      if (idish) score -= 3;
      if (raw.replace(/\D/g, '').length >= 9) score -= 6; // long digit runs are refs/phones
      cands.push({ value: v, currency: cur, line: i, score });
    };
    for (const m of line.matchAll(PREFIX_RE)) {
      tagged = true;
      add(m[2], currencyOf(m[1]), 4);
    }
    for (const m of line.matchAll(SUFFIX_RE)) {
      tagged = true;
      add(m[1], currencyOf(m[2]), 4);
    }
    if (!tagged && rupeeContext) {
      const fixed = rupeeMisread(line);
      if (fixed) {
        tagged = true;
        add(fixed, 'INR', 3.5);
      }
    }
    if (!tagged) {
      const bm = line.match(BARE_NUMBER_LINE);
      if (bm) {
        const v = toNumber(bm[1]);
        if (!isYearLike(v, bm[1])) add(bm[1], null, 1.5);
      }
    }
  });

  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score || b.value - a.value);
  const best = cands[0];
  return best.score > -2 ? best : null;
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------
const FAILED_RE = /\b(failed|failure|declined|unsuccessful|rejected|could not be (?:completed|processed)|transaction failed|payment failed|did not go through|cancell?ed|reversed)\b/i;
const PENDING_RE = /\b(pending|processing|in progress|awaiting|under process|scheduled|on hold|will be credited)\b/i;
const OUT_STRONG = [
  /\bpaid to\b/i, /\bsent to\b/i, /\byou paid\b/i, /\byou sent\b/i, /\bpayment (?:successful|sent|complete|completed|done)\b/i,
  /\bdebited\b/i, /\bmoney sent\b/i, /\btransfer(?:red)? to\b/i, /\bpaid successfully\b/i, /\bpayment to\b/i, /\bpaid\s*$/i, /^-\s?[$₹]/,
];
const IN_STRONG = [
  /\breceived from\b/i, /\bpaid you\b/i, /\bsent you\b/i, /\bcredited to (?:your|a\/c|ac|account)\b/i, /\brefund(?:ed)?\b/i,
  /\bmoney received\b/i, /\byou received\b/i, /\bpayment received\b/i, /\bcashback (?:received|credited)\b/i, /^\+\s?[$₹]/, /\breceived\s*$/i,
];

function findDirection(lines: string[], text: string): Direction {
  if (FAILED_RE.test(text)) return 'failed';
  let out = 0;
  let inn = 0;
  for (const l of lines) {
    for (const re of OUT_STRONG) if (re.test(l)) out += 3;
    for (const re of IN_STRONG) if (re.test(l)) inn += 3;
  }
  if (out === 0 && inn === 0) {
    if (/\b(paid|sent|debit)\b/i.test(text)) out += 1;
    if (/\b(received|credit(?:ed)?)\b/i.test(text) && !/credit card/i.test(text)) inn += 1;
  }
  if (PENDING_RE.test(text) && !/\b(successful|completed|success)\b/i.test(text)) return 'pending';
  if (out > inn) return 'out';
  if (inn > out) return 'in';
  return out > 0 ? 'out' : 'unknown';
}

// ---------------------------------------------------------------------------
// Payee
// ---------------------------------------------------------------------------
function cleanPayee(raw: string): string | null {
  let p = raw
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b[\w.\-]+@[\w.\-]+\b/g, ' ') // VPA / email
    .replace(PREFIX_RE, ' ')
    .replace(SUFFIX_RE, ' ')
    .replace(/\b(?:on|at)\s+\d.*$/i, ' ')
    .replace(/\b(?:upi id|vpa|mobile|ph)\b.*$/i, ' ')
    .replace(/\+?\d[\d\s-]{8,}\d/g, ' ')
    .replace(/[•*·|:]+\s*$/g, '')
    .replace(/^[\s:\-–]+|[\s:\-–.,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (p.length < 2) return null;
  if (/^(you|your account|me|my account|self)$/i.test(p)) return null;
  if (p.length > 42) p = p.slice(0, 42).trim();
  return p;
}

function looksLikeAccount(s: string): boolean {
  return /\b(bank|a\/c|account|card|wallet|balance|xx\d|••|\*\*)\b|x{2,}\d|•{2}\d|\*{2,}\d/i.test(s);
}

function findPayee(lines: string[], direction: Direction): string | null {
  const wantIn = direction === 'in';
  const LABEL_ONLY_OUT = /^(paid to|sent to|to|payment to|paying|transfer to|paid successfully to|merchant|payee|beneficiary)\s*:?$/i;
  const LABEL_ONLY_IN = /^(received from|from|sender|paid by)\s*:?$/i;
  const nextUseful = (i: number) => {
    for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
      const c = cleanPayee(lines[j]);
      if (c && !looksLikeAccount(lines[j]) && !BARE_NUMBER_LINE.test(lines[j])) return c;
    }
    return null;
  };

  const tryOut = (): string | null => {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (LABEL_ONLY_OUT.test(l)) {
        const n = nextUseful(i);
        if (n) return n;
      }
      let m = l.match(/\byou (?:paid|sent)\s+(?:[$₹]?[\d,.]+\s*(?:usd|inr)?\s+(?:to\s+)?)?(.+?)(?:\s+[$₹][\d,.]+.*)?$/i);
      if (m) {
        const c = cleanPayee(m[1]);
        if (c && !/^to$/i.test(c)) return c.replace(/^to\s+/i, '');
      }
      m = l.match(/\b(?:paid(?: successfully)? to|sent to|payment to|transfer(?:red)? to|paying)\s*:?\s*(.+)$/i);
      if (m) {
        const c = cleanPayee(m[1]);
        if (c && !looksLikeAccount(m[1])) return c;
      }
      m = l.match(/^to\s*:?\s+(.+)$/i);
      if (m && !looksLikeAccount(m[1])) {
        const c = cleanPayee(m[1]);
        if (c) return c;
      }
      m = l.match(/[$₹][\d,.]+\s+to\s+(.+)$/i);
      if (m) {
        const c = cleanPayee(m[1]);
        if (c && !looksLikeAccount(m[1])) return c;
      }
    }
    // SMS style: "Sent Rs.380 From HDFC Bank A/C *4421 To THIRD WAVE COFFEE On 15/11/26 Ref …"
    for (const l of lines) {
      const m = l.match(/\bto\s+(?!your\b|bank\b|self\b)([A-Za-z][^.]*?)(?=\s+(?:on|ref|upi|via|at|using)\b|[.;]|$)/i);
      if (m && !looksLikeAccount(m[1]) && !/^\d/.test(m[1])) {
        const c = cleanPayee(m[1]);
        if (c) return c;
      }
    }
    return null;
  };

  const tryIn = (): string | null => {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (LABEL_ONLY_IN.test(l)) {
        const n = nextUseful(i);
        if (n) return n;
      }
      let m = l.match(/^(.+?)\s+(?:paid|sent)\s+you\b/i);
      if (m) {
        const c = cleanPayee(m[1]);
        if (c) return c;
      }
      m = l.match(/\b(?:received from|refund from|from)\s*:?\s+(.+)$/i);
      if (m && !looksLikeAccount(m[1])) {
        const c = cleanPayee(m[1]);
        if (c) return c;
      }
    }
    return null;
  };

  return wantIn ? (tryIn() ?? tryOut()) : (tryOut() ?? (direction === 'unknown' ? tryIn() : null));
}

// ---------------------------------------------------------------------------
// Date & time
// ---------------------------------------------------------------------------
interface YMD {
  y: number;
  m: number; // 0-based
  d: number;
}

function validYMD(y: number, m: number, d: number): YMD | null {
  if (m < 0 || m > 11 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return { y, m, d };
}

function findDate(lines: string[], now: Date, preferUS: boolean): { ymd: YMD; line: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const r = findDateIn(lines[i], now, preferUS, false);
    if (r) return { ymd: r, line: i };
  }
  const r = findDateIn(lines.join('\n'), now, preferUS, true);
  if (!r) return null;
  const line = lines.findIndex((l) => /\b(today|yesterday)\b/i.test(l));
  return { ymd: r, line };
}

function findDateIn(text: string, now: Date, preferUS: boolean, relative: boolean): YMD | null {
  let m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) {
    const r = validYMD(+m[1], +m[2] - 1, +m[3]);
    if (r) return r;
  }
  // 15 Nov 2026 / 15 November, 2026 / 15-Nov-26
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?[\s,\-]+(\d{4}|\d{2})\b/);
  if (m && monthIndex(m[2]) >= 0) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const r = validYMD(y, monthIndex(m[2]), +m[1]);
    if (r) return r;
  }
  // Nov 15, 2026
  m = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && monthIndex(m[1]) >= 0) {
    const r = validYMD(+m[3], monthIndex(m[1]), +m[2]);
    if (r) return r;
  }
  // 15/11/2026, 11/15/2026, 15-11-26
  m = text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    let day = a;
    let mon = b;
    if (a > 12) { day = a; mon = b; } else if (b > 12) { day = b; mon = a; } else if (preferUS) { day = b; mon = a; }
    const r = validYMD(y, mon - 1, day);
    if (r) return r;
  }
  // 15 Nov / Nov 15 (no year)
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i)
    ?? null;
  let r: YMD | null = null;
  if (m) r = validYMD(now.getFullYear(), monthIndex(m[2]), +m[1]);
  if (!r) {
    const m2 = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!:)/i);
    if (m2) r = validYMD(now.getFullYear(), monthIndex(m2[1]), +m2[2]);
  }
  if (r) {
    const cand = new Date(r.y, r.m, r.d);
    if (cand.getTime() - now.getTime() > 2 * 86400000) r.y -= 1;
    return r;
  }
  if (!relative) return null;
  if (/\byesterday\b/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  }
  if (/\btoday\b|\bjust now\b|\bmins? ago\b/i.test(text)) {
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  }
  return null;
}

function timeIn(text: string): { h: number; min: number } | null {
  for (const m of text.matchAll(/(?<![\d:.$₹])(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?)?(?![\d])/gi)) {
    let h = +m[1];
    const min = +m[2];
    if (min > 59) continue;
    const ap = m[3]?.toLowerCase().replace(/[.\s]/g, '');
    if (!ap && m[0].includes('.')) continue; // "18.50" is money, not a time
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23) continue;
    return { h, min };
  }
  return null;
}

/** Prefer the time printed next to the date; skip a phone status-bar clock at the very top. */
function findTime(lines: string[], dateLine: number): { h: number; min: number } | null {
  if (dateLine >= 0) {
    const t = timeIn(lines[dateLine]) ?? (lines[dateLine + 1] ? timeIn(lines[dateLine + 1]) : null);
    if (t) return t;
  }
  for (let i = 0; i < lines.length; i++) {
    if (i < 3 && /^\d{1,2}:\d{2}$/.test(lines[i]) && lines.length > 4) continue; // status bar clock
    const t = timeIn(lines[i]);
    if (t) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reference
// ---------------------------------------------------------------------------

/** Labels in priority order: bank/UPI references are shared across apps, so they win for de-duplication. */
const REF_LABELS: RegExp[] = [
  /(?:upi\s*(?:ref(?:erence)?|transaction)\s*(?:id|no\.?|number)?|utr(?:\s*(?:no\.?|number))?)\s*[:#.\-]?\s*/i,
  /(?:google transaction id|transaction\s*(?:id|no\.?|number|ref)|txn\s*(?:id|no\.?)?|confirmation\s*(?:code|number|#)?|payment\s*id|identifier\s*#?)\s*[:#.\-]?\s*/i,
  /(?:\bref(?:erence)?\s*(?:id|no\.?|number|#)?|order\s*id)\s*[:#.\-]?\s*/i,
];

function findRef(lines: string[], text: string, upiContext: boolean): string | null {
  const take = (raw: string): string | null => {
    // digit groups ("6319 2284 7710") join; stop at the first word after the id
    const tok = raw.trim().match(/^#?([A-Za-z0-9]+(?:[ \-]\d{3,}(?![A-Za-z]))*)/);
    if (!tok) return null;
    const v = tok[1].replace(/[\s\-]/g, '');
    if (v.length < 4 || !/\d/.test(v)) return null;
    return v.slice(-Math.min(6, v.length)).toUpperCase();
  };
  for (const re of REF_LABELS) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const m = l.match(re);
      if (!m || m.index === undefined) continue;
      const rest = l.slice(m.index + m[0].length).trim();
      if (rest) {
        const r = take(rest);
        if (r) return r;
      } else if (lines[i + 1] && /^[A-Za-z0-9 \-#]{4,40}$/.test(lines[i + 1])) {
        const r = take(lines[i + 1]);
        if (r) return r;
      }
    }
  }
  if (upiContext) {
    const m = text.match(/(?<!\d)(\d{4}\s?\d{4}\s?\d{4})(?!\d)/);
    if (m) return take(m[1]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Payment method
// ---------------------------------------------------------------------------
function last4Near(text: string): string | null {
  const m =
    text.match(/(?:x{2,}|\*{2,}|•{1,}|\.{2,}|ending(?: in)?|a\/c(?: no\.?)?|acct|account|card)\s*[:#]?\s*(\d{4})\b/i) ??
    text.match(/\b[xX]+(\d{4})\b/);
  return m ? m[1] : null;
}

function findMethod(text: string, app: string | null, currency: CurrencyCode): { method: string | null; tag: MethodTag | null } {
  const bank = BANKS.find((b) => b.re.test(text));
  const l4 = last4Near(text);
  const mask = l4 ? ` ••${l4}` : '';
  const isCreditCard = /credit\s*card|rupay credit|\bcc\b/i.test(text);
  const isDebitCard = /debit\s*card/i.test(text);
  const network = text.match(/\b(visa|mastercard|rupay|amex|discover)\b/i)?.[1];
  const net = network ? network.charAt(0).toUpperCase() + network.slice(1).toLowerCase() : null;
  const netLabel = net === 'Rupay' ? 'RuPay' : net === 'Mastercard' ? 'Mastercard' : net;
  const upi = /\bupi\b/i.test(text) || currency === 'INR';

  switch (app) {
    case 'Kiwi':
      return { method: `Kiwi · RuPay credit card${mask}`, tag: 'Credit' };
    case 'Venmo':
      if (netLabel || /\bcard\b/i.test(text) && !/venmo (?:debit )?card/i.test(text) && !/balance/i.test(text))
        return { method: `Venmo · ${netLabel ?? 'Card'}${mask}`, tag: isDebitCard ? 'Debit' : 'Credit' };
      if (bank) return { method: `Venmo · ${bank.name}${mask}`, tag: 'Bank' };
      return { method: 'Venmo balance', tag: 'Wallet' };
    case 'Cash App':
      if (/cash (?:app )?card/i.test(text)) return { method: `Cash App Card${mask}`, tag: 'Debit' };
      if (bank) return { method: `Cash App · ${bank.name}${mask}`, tag: 'Bank' };
      if (netLabel) return { method: `Cash App · ${netLabel}${mask}`, tag: isCreditCard ? 'Credit' : 'Debit' };
      return { method: 'Cash App balance', tag: 'Wallet' };
    case 'PayPal':
      if (netLabel) return { method: `PayPal · ${netLabel}${mask}`, tag: isDebitCard ? 'Debit' : 'Credit' };
      if (bank) return { method: `PayPal · ${bank.name}${mask}`, tag: 'Bank' };
      return { method: 'PayPal balance', tag: 'Wallet' };
    case 'Zelle':
      return { method: `Zelle · ${bank ? bank.name : 'bank account'}${mask}`, tag: 'Bank' };
    case 'Chime':
      return { method: `Chime${isCreditCard ? ' Credit Builder' : ' debit card'}${mask}`, tag: isCreditCard ? 'Credit' : 'Debit' };
    case 'Apple Pay':
    case 'Google Wallet':
      if (/apple cash/i.test(text)) return { method: 'Apple Cash', tag: 'Wallet' };
      return {
        method: `${app} · ${bank ? bank.name + ' ' : ''}${netLabel ?? 'card'}${mask}`,
        tag: isDebitCard ? 'Debit' : 'Credit',
      };
    case 'Paytm':
      if (/wallet/i.test(text) && !bank) return { method: 'UPI · Paytm wallet', tag: 'Wallet' };
      break;
    case 'Amazon Pay':
      if (/balance|wallet/i.test(text) && !bank) return { method: 'Amazon Pay balance', tag: 'Wallet' };
      break;
    default:
      break;
  }

  if (upi && isCreditCard) {
    return { method: `UPI · ${bank ? bank.name + ' ' : ''}${netLabel === 'RuPay' || /rupay/i.test(text) ? 'RuPay ' : ''}credit card${mask}`, tag: 'Credit' };
  }
  if (isCreditCard) return { method: `${bank ? bank.name + ' ' : ''}${netLabel ?? ''} credit card${mask}`.replace(/\s+/g, ' ').trim(), tag: 'Credit' };
  if (isDebitCard) return { method: `${bank ? bank.name + ' ' : ''}debit card${mask}`, tag: 'Debit' };
  if (/wallet/i.test(text) && !bank) return { method: `${app ?? 'Wallet'} wallet`.replace('Wallet wallet', 'Wallet'), tag: 'Wallet' };
  if (bank) return { method: `${upi ? 'UPI · ' : ''}${bank.name}${mask}`, tag: 'Bank' };
  if (upi && /\bupi\b/i.test(text)) return { method: `UPI${mask ? ' · bank' + mask : ''}`, tag: 'Bank' };
  return { method: null, tag: null };
}

// ---------------------------------------------------------------------------
// Note
// ---------------------------------------------------------------------------
function findNote(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/^(?:note|message|remarks?|memo|description|for|purpose|comment)\s*[:\-]\s*(.+)$/i);
    if (m && m[1].trim().length > 1) return m[1].trim().slice(0, 60);
  }
  for (const l of lines) {
    const m = l.match(/[“"‘']([^”"’']{2,50})[”"’']/);
    if (m) return m[1].trim();
  }
  // Notes people type ("dinner split") are usually short, all-lowercase lines with no digits.
  for (const l of lines) {
    if (/^[a-z][a-z ]{1,38}[a-z]$/.test(l) && l.split(' ').length <= 5 && !STATUS_RE.test(l) && !FAILED_RE.test(l) && !PENDING_RE.test(l) && !/\b(?:upi|pay|bank|share|done|via)\b/.test(l)) {
      return l;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function fmtFound(amount: number, currency: CurrencyCode): string {
  const sym: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const s = sym[currency] ?? currency + ' ';
  return s + (amount % 1 === 0 ? String(amount) : amount.toFixed(2));
}

export function parseReceipt(rawLines: string[], opts: ParseOptions = {}): ParsedReceipt {
  const now = opts.now ?? new Date();
  const lines = rawLines
    .flatMap((l) => String(l ?? '').split(/\r?\n/))
    .map(normalizeLine)
    .filter((l) => l.length > 0);
  const text = lines.join('\n');

  // App (payment apps before banks)
  const appDef = APPS.find((a) => a.re.test(text)) ?? null;
  let app: string | null = appDef?.name ?? null;
  const bankDef = BANKS.find((b) => b.re.test(text)) ?? null;
  if (!app && bankDef && /\b(?:app|net\s?banking|mobile banking|imps|neft|account activity|transaction details)\b/i.test(text)) {
    app = bankDef.name;
  }

  // Direction
  const direction = findDirection(lines, text);

  // Status lines for amount proximity
  const statusLines = new Set<number>();
  lines.forEach((l, i) => {
    if (STATUS_RE.test(l) && !NOISE_LINE_RE.test(l)) statusLines.add(i);
  });

  const region = appDef?.region ?? bankDef?.region ?? null;
  const rupeeContext =
    region === 'IN' || /₹|\brs\b|\binr\b|\bupi\b/i.test(text) || (region === null && opts.homeCurrency === 'INR');
  const amt = findAmount(lines, statusLines, rupeeContext);
  let currency: CurrencyCode =
    amt?.currency ??
    (region === 'US' ? 'USD' : region === 'IN' ? 'INR' : null) ??
    (/\bupi\b/i.test(text) ? 'INR' : null) ??
    opts.homeCurrency ??
    'INR';
  if (!amt?.currency && /₹|\brs\b|\binr\b/i.test(text)) currency = 'INR';

  const amount = amt ? Math.round(amt.value * 100) / 100 : null;

  const payee = findPayee(lines, direction);

  // Date / time
  const dateHit = findDate(lines, now, currency === 'USD');
  const ymd = dateHit?.ymd ?? null;
  const time = findTime(lines, dateHit?.line ?? -1);
  let at: string | null = null;
  if (ymd || time) {
    const base = ymd ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    const t = time ?? { h: 12, min: 0 };
    at = `${base.y}-${pad(base.m + 1)}-${pad(base.d)}T${pad(t.h)}:${pad(t.min)}:00`;
  }

  const upiContext = /\bupi\b|\butr\b/i.test(text) || currency === 'INR';
  const ref = findRef(lines, text, upiContext);
  const { method, tag } = findMethod(text, app, currency);
  const note = findNote(lines);
  const category = direction === 'in' ? null : suggestCategory(payee, note);

  // Confidence
  let confidence = 0;
  if (amount !== null) confidence += amt && amt.currency ? 0.45 : 0.3;
  if (direction === 'out' || direction === 'in') confidence += 0.2;
  else if (direction === 'failed' || direction === 'pending') confidence += 0.1;
  if (payee) confidence += 0.15;
  if (at) confidence += ymd ? 0.08 : 0.04;
  if (ref) confidence += 0.06;
  if (app) confidence += 0.06;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  // Found chips
  const found: string[] = [];
  if (payee) found.push(category ? `${payee} · ${category}` : payee);
  if (amount !== null) found.push(fmtFound(amount, currency));
  if (at) {
    const d = at.slice(0, 10);
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const label = d === today ? 'Today' : `${+at.slice(8, 10)} ${MONTH_LABEL[+at.slice(5, 7) - 1]}`;
    found.push(time ? `${label}, ${at.slice(11, 16)}` : label);
  }
  const statusWord: Record<Direction, string | null> = {
    out: 'Status: paid', in: 'Status: received', failed: 'Status: failed', pending: 'Status: pending', unknown: null,
  };
  if (statusWord[direction]) found.push(statusWord[direction] as string);
  if (app) found.push(app);
  if (ref) found.push(`Ref ••${ref.slice(-4)}`);

  return { amount, currency, direction, payee, at, ref, app, method, methodTag: tag, note, category, confidence, found };
}
