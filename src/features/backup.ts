/**
 * Export & backup (Settings): CSV of every entry, a JSON backup of the whole app state, and restore.
 * Files are written to the cache directory with expo-file-system (SDK 58 `File` / `Paths` API) and
 * handed to the system share sheet with expo-sharing. Nothing is uploaded by Pace itself.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { todayISO } from '@/domain/budget';
import type { Entry } from '@/domain/types';
import { actions, getState } from '@/store';

const BACKUP_APP = 'pace';
const BACKUP_VERSION = 1;

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text for a list of entries (newest first, as stored). */
export function entriesToCsv(entries: Entry[]): string {
  const head = ['Date', 'Time', 'Type', 'Amount', 'Currency', 'Category', 'Payee', 'Note', 'Method', 'Reference', 'App', 'Source', 'Counts to daily budget'];
  const rows = [...entries]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((e) => [
      e.at.slice(0, 10),
      /^\d\d:\d\d/.test(e.at.slice(11, 16)) ? e.at.slice(11, 16) : '',
      e.kind,
      e.kind === 'expense' ? e.amount : -e.amount,
      e.currency,
      e.category,
      e.payee ?? '',
      e.note ?? '',
      e.method ?? '',
      e.ref ?? '',
      e.app ?? '',
      e.source,
      e.countsToBudget ? 'yes' : 'no',
    ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

async function writeAndShare(name: string, content: string, mimeType: string, UTI: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle });
}

/** Write every entry to a CSV and open the share sheet. Returns how many entries were exported. */
export async function exportCsv(): Promise<number> {
  const { entries } = getState();
  await writeAndShare(`pace-spending-${todayISO()}.csv`, entriesToCsv(entries), 'text/csv', 'public.comma-separated-values-text', 'Export spending');
  return entries.length;
}

/** Write a JSON backup of the whole app state and open the share sheet. */
export async function shareBackup(): Promise<void> {
  const data = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), ...getState() };
  await writeAndShare(`pace-backup-${todayISO()}.json`, JSON.stringify(data), 'application/json', 'public.json', 'Back up Pace data');
}

export interface PickedBackup {
  data: Record<string, unknown>;
  entries: number;
  exportedAt: string | null;
}

/** Let the user pick a backup .json. Returns null if they cancel; throws if the file isn't a Pace backup. */
export async function pickBackup(): Promise<PickedBackup | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const text = await new File(res.assets[0].uri).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not a Pace backup.');
  }
  const d = parsed as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || !d.profile || typeof d.profile !== 'object' || !Array.isArray(d.entries)) {
    throw new Error('That file is not a Pace backup.');
  }
  return { data: d, entries: (d.entries as unknown[]).length, exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : null };
}

/** Replace all app data with a picked backup. */
export function applyBackup(b: PickedBackup) {
  // Strip the file's own metadata so it doesn't end up in app state.
  const { app: _app, version: _version, exportedAt: _exportedAt, ...state } = b.data;
  actions.restore(state);
}
