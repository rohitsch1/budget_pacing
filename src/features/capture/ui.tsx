/** Small building blocks shared by the capture screens (add expense, import, share). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { T } from '@/components/ui';
import { MONTH_SHORT, prettyDate, todayISO, addDays } from '@/domain/budget';
import { fmt, SYMBOL } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { getState } from '@/store';
import { C, F, R } from '@/theme/tokens';

/** "Today, 11:40" · "Yesterday, 20:05" · "Fri 13 Nov, 09:12" */
export function whenLabel(at: string | null | undefined, opts: { time?: boolean } = {}): string {
  if (!at) return 'Now';
  const d = at.slice(0, 10);
  const t = at.length >= 16 ? at.slice(11, 16) : '';
  const today = todayISO();
  const day = d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : prettyDate(d);
  return opts.time === false || !t ? day : `${day}, ${t}`;
}

export function shortDate(at: string): string {
  return `${Number(at.slice(8, 10))} ${MONTH_SHORT[Number(at.slice(5, 7)) - 1]}`;
}

/** What the keypad shows: grouped whole part + whatever decimals were typed. */
export function typedAmount(amt: string, currency: CurrencyCode): string {
  if (!amt) return SYMBOL[currency] + '0';
  const [i, d] = amt.split('.');
  const whole = fmt(Number(i || '0'), currency, { decimals: false });
  return d !== undefined ? `${whole}.${d}` : whole;
}

/** Leave the capture flow and land on Today (or the gate if onboarding isn't done). */
export function goHome() {
  if (getState().onboarded) router.dismissTo('/(tabs)');
  else router.replace('/');
}

export function ImpactPill({ left, currency, empty }: { left: number; currency: CurrencyCode; empty?: boolean }) {
  const ok = left >= 0;
  const bg = empty ? C.lineSoft : ok ? C.okSoft : C.coralSoft;
  const fg = empty ? C.inkMuted : ok ? C.ok : C.coralInk;
  const text = empty
    ? 'Type what you paid'
    : ok
      ? `${fmt(left, currency)} left today after this`
      : `${fmt(-left, currency)} over today, tomorrow adjusts`;
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: R.pill, backgroundColor: bg }}>
      <T v="small" color={fg} style={{ fontFamily: F.bodySemi }}>
        {text}
      </T>
    </View>
  );
}

export function CheckDot({ size = 20, bg = C.amber, fg = C.white }: { size?: number; bg?: string; fg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={3.2} strokeLinecap="round">
        <Path d="M5 12l5 5 9-10" />
      </Svg>
    </View>
  );
}

export function Thumb({ uri, w = 40, h = 56, style }: { uri?: string | null; w?: number; h?: number; style?: ViewStyle }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Screenshot thumbnail"
      style={[{ width: w, height: h, borderRadius: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <T v="caption" color={C.inkMuted} style={{ fontSize: 10 }}>
          text
        </T>
      )}
    </View>
  );
}

export function TextLink({ label, onPress, color = C.link }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={8} onPress={onPress}>
      <T v="small" color={color} style={{ fontFamily: F.bodySemi }}>
        {label}
      </T>
    </Pressable>
  );
}
