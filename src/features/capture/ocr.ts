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
  } catch (e) {
    console.warn('[pace] text recognition unavailable', e instanceof Error ? e.message : String(e));
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
    // The native module wants a plain path or a content:// URI. Shared files arrive as "file:/data/…"
    // (one slash), which the library's own "file://" stripping misses.
    const target = uri.startsWith('file:') ? decodeURI(uri.replace(/^file:\/*/, '/')) : uri;
    const out = await m.extractTextFromImage(target);
    return Array.isArray(out) ? out.filter((x) => typeof x === 'string') : [];
  } catch (e) {
    console.warn('[pace] text recognition failed', e instanceof Error ? e.message : String(e));
    return [];
  }
}
