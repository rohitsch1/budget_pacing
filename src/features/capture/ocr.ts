/**
 * On-device text recognition (expo-text-extractor: ML Kit on Android, Vision on iOS).
 * Nothing is uploaded. Loaded lazily so a build without the native module still works —
 * callers then fall back to typing the amount.
 */
type Extractor = { isSupported: boolean; extractTextFromImage: (uri: string) => Promise<string[]> };

let mod: Extractor | null | undefined;

async function load(): Promise<Extractor | null> {
  if (mod !== undefined) return mod;
  try {
    const m = await import('expo-text-extractor');
    mod = { isSupported: !!m.isSupported, extractTextFromImage: m.extractTextFromImage };
  } catch {
    mod = null;
  }
  return mod;
}

export async function isOcrSupported(): Promise<boolean> {
  const m = await load();
  return !!m?.isSupported;
}

/** Returns recognised text blocks/lines, or [] when OCR is unavailable or fails. */
export async function extractTextFromImage(uri: string): Promise<string[]> {
  const m = await load();
  if (!m?.isSupported) return [];
  try {
    const out = await m.extractTextFromImage(uri);
    return Array.isArray(out) ? out.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
