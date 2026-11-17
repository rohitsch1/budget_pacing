/**
 * Content shared into Pace from another app (Google Pay, PhonePe, Venmo, a screenshot…) arrives as a
 * system path with host "expo-sharing". Route it to the share handler.
 * Docs: https://docs.expo.dev/versions/v58.0.0/sdk/sharing/
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/share/handle';
    }
    return path;
  } catch {
    return '/';
  }
}
