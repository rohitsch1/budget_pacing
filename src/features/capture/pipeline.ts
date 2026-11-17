/**
 * Shared capture pipeline used by the share sheet handler and screenshot import:
 *   payload → (OCR if image) → parse → duplicate check → route.
 * Everything runs on the phone. Nothing is deleted from the user's gallery.
 */
import { clearSharedPayloads } from 'expo-sharing';

import { dayPlan, todayISO } from '@/domain/budget';
import type { Entry, EntryKind } from '@/domain/types';
import { actions, getState, newId } from '@/store';

import { findDuplicate } from './dedupe';
import { extractTextFromImage } from './ocr';
import { parseReceipt, type ParsedReceipt } from './parser';
import { dropSession, getSession, putSession, type CaptureSession } from './session';

export type CaptureRoute = 'quick' | '/import/confirm' | '/share/duplicate' | '/share/received' | '/share/unread';

export interface PipelineInput {
  imageUri?: string;
  text?: string;
  pendingId?: string;
  source: 'share' | 'screenshot';
  fromShareSheet?: boolean;
}

export interface PipelineResult {
  session: CaptureSession;
  route: CaptureRoute;
}

/** Confidence needed for the one-tap "Add expense" card. */
export const QUICK_CONFIDENCE = 0.75;

function localNowISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function decideRoute(parsed: ParsedReceipt, duplicateId: string | null, allowQuick: boolean): CaptureRoute {
  if (parsed.amount === null || parsed.direction === 'failed') return '/share/unread';
  if (duplicateId) return '/share/duplicate';
  if (parsed.direction === 'in') return '/share/received';
  if (allowQuick && parsed.direction === 'out' && parsed.confidence >= QUICK_CONFIDENCE) return 'quick';
  return '/import/confirm';
}

export async function runPipeline(input: PipelineInput, opts: { allowQuick?: boolean } = {}): Promise<PipelineResult> {
  const st = getState();
  const pending = input.pendingId ? st.pending.find((p) => p.id === input.pendingId) : undefined;
  const imageUri = input.imageUri ?? pending?.imageUri;
  let text = input.text ?? pending?.text;

  // Text payloads (bank SMS, "share as text") skip OCR.
  let lines: string[] = [];
  if (text && text.trim()) lines = text.split(/\r?\n/);
  else if (imageUri) {
    lines = await extractTextFromImage(imageUri);
    text = lines.join('\n');
  }

  // Keep it safe until the user decides, so nothing is lost if they leave.
  let pendingId = pending?.id ?? null;
  if (!pendingId && (imageUri || text)) {
    pendingId = actions.addPending({ imageUri, text: text || undefined }).id;
  }

  const parsed = parseReceipt(lines, { homeCurrency: st.profile.currency, now: new Date() });
  const dup =
    parsed.amount !== null && parsed.direction !== 'failed'
      ? findDuplicate(st.entries, { amount: parsed.amount, ref: parsed.ref, at: parsed.at ?? localNowISO(), incoming: parsed.direction === 'in' })
      : null;

  const session = putSession({
    id: newId('cap'),
    parsed,
    source: input.source,
    pendingId,
    imageUri,
    text,
    duplicateId: dup?.entry.id ?? null,
    fromShareSheet: !!input.fromShareSheet,
  });
  return { session, route: decideRoute(parsed, session.duplicateId, !!opts.allowQuick) };
}

/** Done with a receipt (added, merged or skipped): forget the pending item and shared cache files. */
export function finishSession(sid: string | null | undefined) {
  const s = getSession(sid);
  if (!s) return;
  if (s.pendingId) actions.removePending(s.pendingId);
  if (s.fromShareSheet) {
    try {
      clearSharedPayloads();
    } catch {
      // not available on this platform
    }
  }
  dropSession(s.id);
}

export interface SaveFields {
  kind?: EntryKind;
  amount: number;
  category?: string;
  payee?: string | null;
  note?: string | null;
  at?: string | null;
  method?: string | null;
}

/** Turn a session (+ user edits) into an entry. */
export function saveFromSession(sid: string | null | undefined, f: SaveFields): Entry {
  const s = getSession(sid);
  const p = s?.parsed;
  const profile = getState().profile;
  const kind = f.kind ?? 'expense';
  const entry = actions.addEntry({
    kind,
    amount: Math.abs(f.amount),
    currency: p?.currency ?? profile.currency,
    category: f.category ?? (kind === 'expense' ? (p?.category ?? 'Other') : 'Income'),
    payee: (f.payee ?? p?.payee) || undefined,
    note: (f.note ?? p?.note) || undefined,
    method: (f.method ?? p?.method) || undefined,
    methodTag: p?.methodTag ?? undefined,
    ref: p?.ref ?? undefined,
    app: p?.app ?? undefined,
    source: s?.source ?? 'screenshot',
    at: f.at ?? p?.at ?? localNowISO(),
    countsToBudget: true,
  });
  finishSession(sid);
  return entry;
}

/** Same payment: fill the gaps in the stored entry with the clearer details from this receipt. */
export function mergeIntoExisting(sid: string | null | undefined, entryId: string) {
  const s = getSession(sid);
  const e = getState().entries.find((x) => x.id === entryId);
  if (s && e) {
    const p = s.parsed;
    actions.updateEntry(e.id, {
      payee: e.payee || p.payee || undefined,
      note: e.note || p.note || undefined,
      method: e.method && e.method !== 'Cash' && e.method !== 'UPI' ? e.method : (p.method ?? e.method),
      methodTag: e.methodTag ?? p.methodTag ?? undefined,
      ref: e.ref || p.ref || undefined,
      app: e.app || p.app || undefined,
    });
  }
  finishSession(sid);
}

/** Today's "left" before/after a hypothetical entry, using the budget engine. */
export function impactOf(draft: { kind: EntryKind; amount: number; at?: string | null } | null) {
  const { profile, entries } = getState();
  const today = todayISO();
  const before = dayPlan(profile, entries, today);
  if (!draft || !draft.amount) return { before, after: before };
  const fake: Entry = {
    id: 'draft',
    kind: draft.kind,
    amount: Math.abs(draft.amount),
    currency: profile.currency,
    category: 'Other',
    source: 'manual',
    at: draft.at ?? localNowISO(),
    createdAt: new Date().toISOString(),
    countsToBudget: true,
  };
  const after = dayPlan(profile, [fake, ...entries], today);
  return { before, after };
}

export { localNowISO };
