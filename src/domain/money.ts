import type { CurrencyCode } from './types';

export const SYMBOL: Record<CurrencyCode, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$', CAD: 'C$', AUD: 'A$',
};

/** Group digits without relying on Intl (Hermes ICU varies by device). */
function group(intPart: string, indian: boolean): string {
  if (!indian) return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return rest + ',' + last3;
}

/**
 * fmt(1234.5, 'INR') → "₹1,235"   fmt(18.5, 'USD', { decimals: true }) → "$18.50"
 * INR uses Indian grouping (1,00,000). Whole units by default.
 */
export function fmt(
  value: number,
  currency: CurrencyCode = 'INR',
  opts: { decimals?: boolean; sign?: boolean } = {},
): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  const decimals = opts.decimals ?? (currency !== 'INR' && abs % 1 !== 0);
  const fixed = decimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [i, d] = fixed.split('.');
  const body = group(i, currency === 'INR') + (d ? '.' + d : '');
  const s = SYMBOL[currency] + body;
  if (neg) return '−' + s;
  if (opts.sign) return '+' + s;
  return s;
}

export function currencyForCountry(country: string): CurrencyCode {
  const m: Record<string, CurrencyCode> = {
    India: 'INR', 'United States': 'USD', 'United Kingdom': 'GBP', 'United Arab Emirates': 'AED',
    Singapore: 'SGD', Canada: 'CAD', Australia: 'AUD', Germany: 'EUR', France: 'EUR', Netherlands: 'EUR', Ireland: 'EUR',
  };
  return m[country] ?? 'USD';
}
