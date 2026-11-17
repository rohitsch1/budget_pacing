/**
 * Realistic OCR outputs (one string per recognised block/line) used to check the receipt reader.
 * Run: node --experimental-strip-types src/features/capture/parser.run.mjs
 */
import type { CurrencyCode } from '@/domain/types';

import type { ParsedReceipt } from './parser';

export interface ParserCase {
  name: string;
  lines: string[];
  homeCurrency?: CurrencyCode;
  expect: Partial<ParsedReceipt> & { minConfidence?: number; maxConfidence?: number };
}

/** Fixed "now" for all cases: Sun 15 Nov 2026, 12:00 local */
export const NOW = new Date(2026, 10, 15, 12, 0, 0);

export const CASES: ParserCase[] = [
  {
    name: 'Google Pay paid (merchant)',
    lines: [
      '11:41', '4G', 'Google Pay', '₹380', 'Paid to Third Wave Coffee', 'thirdwave.coffee@okaxis',
      'Completed', '15 Nov 2026, 11:40 am', 'HDFC Bank ••••4421', 'UPI transaction ID', '631922847710',
      'Google transaction ID', 'CICAgKD7pYvQaw', 'Share',
    ],
    expect: { amount: 380, currency: 'INR', direction: 'out', payee: 'Third Wave Coffee', at: '2026-11-15T11:40:00', app: 'Google Pay', methodTag: 'Bank', minConfidence: 0.8 },
  },
  {
    name: 'PhonePe paid',
    lines: [
      'Transaction Successful', '11:40 am on 15 Nov 2026', 'Paid to', 'Third Wave Coffee', 'thirdwavecoffee@ybl', '₹380',
      'Transfer Details', 'Transaction ID', 'T2611151140221234567', 'Debited from', 'XXXXXXXX4421', '₹380',
      'UTR: 631922847710', 'Powered by', 'HDFC Bank', 'PhonePe',
    ],
    expect: { amount: 380, direction: 'out', payee: 'Third Wave Coffee', app: 'PhonePe', ref: '847710', method: 'UPI · HDFC Bank ••4421', methodTag: 'Bank', minConfidence: 0.8 },
  },
  {
    name: 'Paytm wallet payment',
    lines: [
      'Paytm', 'Paid Successfully to', 'Swiggy', '₹ 456', 'Paid from Paytm Wallet', 'Wallet balance ₹1,204.50',
      '14 Nov 2026, 08:05 PM', 'UPI Ref No: 431912345678', 'Order ID: 2026111420051234',
    ],
    expect: { amount: 456, direction: 'out', payee: 'Swiggy', app: 'Paytm', method: 'UPI · Paytm wallet', methodTag: 'Wallet', at: '2026-11-14T20:05:00', category: 'Food' },
  },
  {
    name: 'BHIM SBI',
    lines: [
      'BHIM', 'Payment Successful', 'Rs.1,250.00', 'Sent to Ramesh Kirana Store', 'ramesh.kirana@sbi',
      'From: State Bank of India - XX1180', 'Date: 13/11/2026 09:12', 'UPI Ref No 631712009988',
    ],
    expect: { amount: 1250, direction: 'out', payee: 'Ramesh Kirana Store', app: 'BHIM', at: '2026-11-13T09:12:00', ref: '009988', method: 'UPI · SBI ••1180', methodTag: 'Bank', category: 'Groceries' },
  },
  {
    name: 'Kiwi credit card on UPI',
    lines: [
      'kiwi', 'Payment Successful!', '₹249', 'Paid to Blinkit', 'blinkit@kotak', 'Via Kiwi RuPay Credit Card XX0912',
      'Nov 15, 2026 at 10:02 AM', 'UPI Ref ID: 631910020001', 'You earned 2 Kiwis',
    ],
    expect: { amount: 249, direction: 'out', payee: 'Blinkit', app: 'Kiwi', method: 'Kiwi · RuPay credit card ••0912', methodTag: 'Credit', at: '2026-11-15T10:02:00' },
  },
  {
    name: 'Venmo paid',
    lines: ['Venmo', 'You paid Blue Bottle Coffee', '$18.50', 'Nov 15, 2026 at 11:40 AM', 'Note', '"oat latte + pastry"', 'Payment method: Venmo balance', 'Transaction ID 3984414F2C'],
    homeCurrency: 'USD',
    expect: { amount: 18.5, currency: 'USD', direction: 'out', payee: 'Blue Bottle Coffee', method: 'Venmo balance', methodTag: 'Wallet', ref: '414F2C', note: 'oat latte + pastry' },
  },
  {
    name: 'Venmo received',
    lines: ['Venmo', 'Alex Kim paid you', '+ $25.00', 'Pizza night 🍕', 'Nov 14, 2026', 'Transfer to bank'],
    homeCurrency: 'USD',
    expect: { amount: 25, currency: 'USD', direction: 'in', payee: 'Alex Kim', app: 'Venmo' },
  },
  {
    name: 'Cash App card',
    lines: ['Cash App', 'Payment to $tacoshop', '$12.75', 'Completed', 'Paid with Cash Card ••5521', 'Nov 13 at 7:15 PM', 'Identifier #D7Q9XK'],
    homeCurrency: 'USD',
    expect: { amount: 12.75, currency: 'USD', direction: 'out', app: 'Cash App', method: 'Cash App Card ••5521', methodTag: 'Debit', at: '2026-11-13T19:15:00' },
  },
  {
    name: 'PayPal Visa',
    lines: ['PayPal', 'You sent $30.00 USD to Sam Lee', 'Payment sent', 'Nov 12, 2026', 'Paid with', 'Visa Credit ••3310', 'Transaction ID', '8VJ12345AB678901C'],
    homeCurrency: 'USD',
    expect: { amount: 30, currency: 'USD', direction: 'out', payee: 'Sam Lee', app: 'PayPal', method: 'PayPal · Visa ••3310', methodTag: 'Credit', ref: '78901C' },
  },
  {
    name: 'Zelle in Chase app',
    lines: [
      'CHASE', 'Zelle®', 'You sent $45.00 to John Smith', 'Sent on Nov 10, 2026', 'From: TOTAL CHECKING (...6789)',
      'Available balance $2,310.44', 'Confirmation number', '1234567890',
    ],
    homeCurrency: 'USD',
    expect: { amount: 45, currency: 'USD', direction: 'out', payee: 'John Smith', app: 'Zelle', methodTag: 'Bank', at: '2026-11-10T12:00:00' },
  },
  {
    name: 'Google Pay received (dinner split)',
    lines: ['Google Pay', '₹1,200', 'Received from Arjun M', '“dinner split”', 'Completed', '15 Nov 2026, 9:15 pm', 'UPI transaction ID', '632011223344', 'To: HDFC Bank 4421'],
    expect: { amount: 1200, direction: 'in', payee: 'Arjun M', note: 'dinner split', at: '2026-11-15T21:15:00', ref: '223344' },
  },
  {
    name: 'PhonePe failed',
    lines: ['Transaction Failed', '₹540', 'Paid to Uber India', 'Your money has not been debited. If debited, it will be refunded in 3-5 days', '15 Nov 2026, 08:30 am', 'Transaction ID T2611150830', 'PhonePe'],
    expect: { amount: 540, direction: 'failed', app: 'PhonePe' },
  },
  {
    name: 'Cropped screenshot (no amount)',
    lines: ['Swiggy', 'Order delivered', 'Paid via UPI', 'Today, 8:05 pm'],
    expect: { amount: null, at: '2026-11-15T20:05:00', maxConfidence: 0.6 },
  },
  {
    name: 'Bank SMS text share (HDFC debit)',
    lines: ['Sent Rs.380.00 From HDFC Bank A/C *4421 To THIRD WAVE COFFEE ROAST On 15/11/26 Ref 631922847710 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808'],
    expect: { amount: 380, direction: 'out', payee: 'THIRD WAVE COFFEE ROAST', ref: '847710', at: '2026-11-15T12:00:00', methodTag: 'Bank' },
  },
  {
    name: 'Amazon Pay pending',
    lines: ['amazon pay', 'Payment Pending', '₹1,999.00', 'to Croma Electronics', 'We are processing your payment', '15 Nov 2026, 11:00 am'],
    expect: { amount: 1999, direction: 'pending', app: 'Amazon Pay' },
  },
  {
    name: 'CRED credit card UPI with balance noise',
    lines: ['CRED', 'payment successful', '₹2,450', 'paid to Decathlon Sports', 'HDFC Bank Credit Card ••7788', 'available limit ₹84,550', '13 Nov 2026, 6:20 pm', 'UPI ref: 631718181818'],
    expect: { amount: 2450, direction: 'out', app: 'CRED', payee: 'Decathlon Sports', methodTag: 'Credit' },
  },
  {
    name: 'Real emulator OCR: ₹ read as 7 (PhonePe)',
    lines: ['PhonePe', 'Payment Successful', '7380', 'Paid to Third Wave Coffee', '17 Nov 2026, 11:40 am', 'UPI Ref No: 631922847710', 'Debited from HDFC Bank XX4421'],
    expect: { amount: 380, currency: 'INR', direction: 'out', payee: 'Third Wave Coffee', app: 'PhonePe', methodTag: 'Bank' },
  },
  {
    name: 'Real emulator OCR: ₹ dropped (Google Pay received)',
    lines: ['Google Pay', 'Received from Arjun M', '1,200', 'Completed', 'dinner split', '17 Nov 2026, 9:15 pm', 'UPI transaction ID: 731122849901'],
    expect: { amount: 1200, currency: 'INR', direction: 'in', app: 'Google Pay', note: 'dinner split' },
  },
  {
    name: '₹ read as a stray glyph',
    lines: ['Paytm', 'Paid Successfully to', 'Chai Point', '%240', '15 Nov 2026, 5:10 pm', 'UPI Ref No: 631811112222'],
    expect: { amount: 240, direction: 'out', payee: 'Chai Point' },
  },
  {
    name: 'US amount that starts with 7 is left alone',
    lines: ['Venmo', 'You paid Alex Kim', '$75.00', 'Nov 14, 2026'],
    expect: { amount: 75, currency: 'USD' },
  },
];
