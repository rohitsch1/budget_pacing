/**
 * In-memory hand-off between capture screens. Route params stay tiny (just `sid`);
 * the parse result lives here. If the app is killed, the PendingImport in the store still has the
 * image/text, so the receipt can be read again from Today.
 */
import type { ParsedReceipt } from './parser';

export interface CaptureSession {
  id: string;
  parsed: ParsedReceipt;
  source: 'share' | 'screenshot';
  pendingId: string | null;
  imageUri?: string;
  text?: string;
  /** id of a stored entry that looks like the same payment */
  duplicateId: string | null;
  /** came from the OS share sheet: clear expo-sharing's cached payloads when done */
  fromShareSheet: boolean;
}

const sessions = new Map<string, CaptureSession>();

export function putSession(s: CaptureSession): CaptureSession {
  sessions.set(s.id, s);
  return s;
}

export function getSession(id: string | undefined | null): CaptureSession | null {
  if (!id) return null;
  return sessions.get(id) ?? null;
}

export function dropSession(id: string) {
  sessions.delete(id);
}

/** Carry the user's edits (amount, payee) forward, e.g. from confirm to "not spending". */
export function patchSession(id: string, patch: Partial<ParsedReceipt>) {
  const s = sessions.get(id);
  if (s) sessions.set(id, { ...s, parsed: { ...s.parsed, ...patch } });
}
