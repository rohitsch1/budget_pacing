/** Small building blocks shared by the capture screens (add expense, import, share). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Chip, T } from '@/components/ui';
import { BUILTIN_CATEGORIES, categoriesFor, MONTH_SHORT, prettyDate, todayISO, addDays } from '@/domain/budget';
import { fmt, SYMBOL } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { actions, getState, useStore } from '@/store';
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

/**
 * Category chips from the user's plan (built-ins + their own) with a "+ New" chip that asks for a name
 * and saves it to profile.customCategories.
 */
export function CategoryPicker({ value, onChange, extra = [], small = false }: { value: string; onChange: (c: string) => void; extra?: string[]; small?: boolean }) {
  const profile = useStore((s) => s.profile);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const base = categoriesFor(profile);
  const cats = [...extra.filter((c) => c && !base.includes(c)), ...base];
  if (value && !cats.includes(value)) cats.unshift(value);

  const commit = () => {
    const n = name.trim().replace(/\s+/g, ' ').slice(0, 24);
    setAdding(false);
    setName('');
    if (!n) return;
    const existing = cats.find((c) => c.toLowerCase() === n.toLowerCase());
    if (existing) {
      onChange(existing);
      return;
    }
    if (n === 'Income' || (BUILTIN_CATEGORIES as readonly string[]).includes(n)) {
      onChange(n);
      return;
    }
    // onSubmitEditing and onBlur can both fire for one entry — read fresh state so it's only added once.
    const now = getState().profile.customCategories ?? [];
    const dup = now.find((c) => c.toLowerCase() === n.toLowerCase());
    if (!dup) actions.updateProfile({ customCategories: [...now, n] });
    onChange(dup ?? n);
  };

  const h = small ? 34 : 38;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: small ? 6 : 8 }}>
      {cats.map((c) => (
        <Chip key={c} label={c} selected={c === value} onPress={() => onChange(c)} style={small ? { height: h } : undefined} />
      ))}
      {adding ? (
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder="Category name"
          placeholderTextColor={C.inkFaint}
          returnKeyType="done"
          maxLength={24}
          accessibilityLabel="New category name"
          style={{ height: h, minWidth: 140, paddingHorizontal: 14, borderRadius: R.pill, borderWidth: 1, borderColor: C.harbor, backgroundColor: C.white, fontFamily: F.bodySemi, fontSize: 14, color: C.ink }}
        />
      ) : (
        <Chip label="+ New" onPress={() => setAdding(true)} style={{ height: h, borderStyle: 'dashed' }} />
      )}
    </View>
  );
}

/** "Already in my plan (bill/EMI)" switch: ON means the payment doesn't count toward the daily limit. */
export function PlannedToggle({ value, onChange, hint }: { value: boolean; onChange: (v: boolean) => void; hint?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: value ? C.amberSoft : C.white, borderWidth: 1, borderColor: value ? C.amberSoft : C.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodySemi" style={{ fontSize: 14 }}>
          Already in my plan (bill/EMI)
        </T>
        <T v="caption" color={value ? C.amberInk : C.inkMuted}>
          {value ? (hint ?? "Won't count toward today's limit") : 'Counts toward your daily limit'}
        </T>
      </View>
      <Switch
        accessibilityLabel="Already in my plan, bill or EMI"
        value={value}
        onValueChange={onChange}
        trackColor={{ true: C.harbor, false: C.chipLine }}
        thumbColor={C.white}
      />
    </View>
  );
}
