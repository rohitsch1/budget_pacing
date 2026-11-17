/**
 * Onboarding building blocks: the chat-style scaffold, Pace / reply bubbles with pop-in motion,
 * amount + due-day inputs, toggles and the edit-mode aware navigation hook.
 */
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, PaceBubble, T } from '@/components/ui';
import { SYMBOL } from '@/domain/money';
import type { CurrencyCode, Weekday } from '@/domain/types';
import { C, F, R, S } from '@/theme/tokens';

import { fmtBare, onThe } from './logic';

// ---------- navigation ----------
/** `edit=1` → primary button says Save and goes back; otherwise pushes the next step. */
export function useObFlow(next: Href) {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1';
  return {
    isEdit,
    label: (l: string) => (isEdit ? 'Save' : l),
    go: () => (isEdit ? router.back() : router.push(next)),
    skip: () => router.push(next),
  };
}

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/onboarding/welcome');
}

// ---------- scaffold ----------
export function ObScaffold({
  chapter,
  dark = false,
  back = true,
  right,
  footer,
  children,
  gap = 14,
}: {
  chapter?: string;
  dark?: boolean;
  back?: boolean;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  gap?: number;
}) {
  const insets = useSafeAreaInsets();
  const bg = dark ? C.harbor : C.paper;
  const ink = dark ? C.onDark : C.ink;
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {back || chapter || right ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              paddingTop: insets.top + 4,
              paddingHorizontal: S.gutter,
            }}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={goBack}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }}>
                <Icon name="back" color={ink} />
              </Pressable>
            ) : null}
            <T v="label" color={dark ? C.onDarkMuted : C.link} style={{ flex: 1 }}>
              {chapter ?? ''}
            </T>
            {right}
          </View>
        ) : (
          <View style={{ height: insets.top + 12 }} />
        )}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: S.gutter, paddingTop: 8, paddingBottom: 24, gap, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer ? (
          <View style={{ paddingHorizontal: S.gutter, paddingTop: 8, paddingBottom: insets.bottom + 16, gap: 8, backgroundColor: bg }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

export function SkipLink({ onPress, label = 'Skip for now', dark = false }: { onPress: () => void; label?: string; dark?: boolean }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress} style={{ paddingHorizontal: 4, paddingVertical: 10 }}>
      <T v="bodySemi" color={dark ? C.mint : C.link} style={{ fontSize: 14 }}>
        {label}
      </T>
    </Pressable>
  );
}

// ---------- chat ----------
export function Bubble({ children, delay = 150 }: { children: ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(450)}>
      <PaceBubble>{children}</PaceBubble>
    </Animated.View>
  );
}

/** Pace's reply to the user's answer (right aligned, harbor). Re-animates when `k` changes. */
export function Reply({ children, k, delay = 250 }: { children: ReactNode; k?: string; delay?: number }) {
  return (
    <Animated.View key={k} entering={FadeIn.delay(delay).duration(350)} style={{ alignSelf: 'flex-end', maxWidth: '88%' }}>
      <View style={{ backgroundColor: C.harbor, borderRadius: 18, borderTopRightRadius: 4, paddingHorizontal: 14, paddingVertical: 12 }}>
        {typeof children === 'string' ? (
          <T v="small" color={C.onDark} style={{ fontSize: 14, lineHeight: 21 }}>
            {children}
          </T>
        ) : (
          children
        )}
      </View>
    </Animated.View>
  );
}

export function Question({ children }: { children: ReactNode }) {
  return (
    <T v="h2" style={{ fontSize: 20, lineHeight: 25 }}>
      {children}
    </T>
  );
}

// ---------- inputs ----------
function parseAmount(s: string): number | null {
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return Math.min(Number(digits), 999999999);
}

export function AmountInput({
  value,
  onChange,
  currency,
  size = 'md',
  label,
  placeholder = '0',
  autoFocus,
  style,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  currency: CurrencyCode;
  size?: 'sm' | 'md' | 'lg';
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
}) {
  const [focused, setFocused] = useState(false);
  const fs = size === 'lg' ? 32 : size === 'md' ? 18 : 15;
  const h = size === 'lg' ? 52 : size === 'md' ? 50 : 40;
  const boxed = size !== 'lg';
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: h,
          minWidth: 0,
        },
        boxed && {
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: C.white,
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? C.harbor : C.line,
        },
        style,
      ]}>
      <T style={{ fontFamily: F.display, fontSize: size === 'lg' ? 22 : fs, color: C.inkMuted }}>{SYMBOL[currency].trim()}</T>
      <TextInput
        accessibilityLabel={label}
        value={value == null ? '' : fmtBare(value, currency)}
        onChangeText={(t) => onChange(parseAmount(t))}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder={placeholder}
        placeholderTextColor={C.inkDisabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectTextOnFocus
        style={{ flex: 1, minWidth: 0, fontFamily: F.display, fontSize: fs, color: C.ink, padding: 0 }}
      />
    </View>
  );
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  autoFocus,
  big = false,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  big?: boolean;
  style?: ViewStyle;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        {
          height: big ? 52 : 44,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: C.white,
          borderWidth: big || focused ? 1.5 : 1,
          borderColor: big || focused ? C.harbor : C.line,
        },
        style,
      ]}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.inkDisabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ fontFamily: big ? F.bodySemi : F.bodyMed, fontSize: big ? 17 : 15, color: C.ink, padding: 0 }}
      />
    </View>
  );
}

/** Day-of-month stepper: − On the 3rd + */
export function DueDayInput({ value, onChange, label = 'Due' }: { value: number; onChange: (d: number) => void; label?: string }) {
  const step = (n: number) => onChange(((value - 1 + n + 31) % 31) + 1);
  const btn = (n: number, icon: string, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => step(n)}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: C.chipLine,
        backgroundColor: pressed ? C.lineSoft : C.white,
        alignItems: 'center',
        justifyContent: 'center',
      })}>
      <T v="h3" style={{ lineHeight: 20 }}>
        {icon}
      </T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`${label}: ${onThe(value)}`}>
      <T v="caption" color={C.inkMuted} style={{ flex: 1 }}>
        {label}
      </T>
      {btn(-1, '−', 'Earlier day')}
      <T v="bodySemi" style={{ minWidth: 110, textAlign: 'center', fontSize: 14 }}>
        {onThe(value)}
      </T>
      {btn(1, '+', 'Later day')}
    </View>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      hitSlop={8}
      style={{
        width: 46,
        height: 28,
        borderRadius: R.pill,
        padding: 3,
        backgroundColor: on ? C.link : C.btnLine,
        alignItems: on ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.white }} />
    </Pressable>
  );
}

export function AddChip({ label, onPress, dark = false }: { label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: R.pill,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: dark ? C.harborSoft : '#B8B1A2',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <T v="small" color={dark ? C.onDark : C.ink} style={{ fontFamily: F.bodyMed }}>
        + {label}
      </T>
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={{ paddingVertical: 6, alignSelf: 'flex-start' }}>
      <T v="bodySemi" color={C.link} style={{ fontSize: 14 }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Radio-style answer row (moods, credit card…) */
export function OptionRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? C.harbor : C.chipLine,
        backgroundColor: selected ? '#E6F6EE' : C.white,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: selected ? C.harbor : C.chipLine,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.harbor }} /> : null}
      </View>
      <T v="body" style={{ flex: 1, fontFamily: F.bodyMed }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#EDE9E0', borderRadius: R.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, height: 40, borderRadius: R.pill, backgroundColor: on ? C.white : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <T v="small" color={on ? C.ink : C.inkMuted} style={{ fontFamily: on ? F.bodySemi : F.bodyMed, fontSize: 14 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** White rounded list container with hairline separators handled by rows. */
export function ListCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 2 }, style]}>
      {children}
    </View>
  );
}

export function Check({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: on ? C.harbor : '#B8B1A2',
        backgroundColor: on ? C.harbor : C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {on ? <Icon name="check" size={14} color={C.white} strokeWidth={3.5} /> : null}
    </View>
  );
}

/** Inline editor for a named monthly amount (bill, EMI, routine item, extra income). */
export function ItemEditor({
  name,
  amount,
  dueDay,
  currency,
  onName,
  onAmount,
  onDueDay,
  onRemove,
  onDone,
  dueLabel = 'Due',
  extra,
}: {
  name: string;
  amount: number;
  dueDay?: number;
  currency: CurrencyCode;
  onName?: (v: string) => void;
  onAmount: (v: number) => void;
  onDueDay?: (v: number) => void;
  onRemove?: () => void;
  onDone: () => void;
  dueLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 10, paddingVertical: 10 }}>
      {onName ? <TextField label="Name" value={name} onChange={onName} placeholder="Name" /> : null}
      <AmountInput label={`${name || 'Item'} amount`} value={amount || null} onChange={(v) => onAmount(v ?? 0)} currency={currency} />
      {onDueDay && dueDay != null ? <DueDayInput value={dueDay} onChange={onDueDay} label={dueLabel} /> : null}
      {extra}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {onRemove ? (
          <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Icon name="trash" size={16} color={C.coralInk} />
            <T v="small" color={C.coralInk} style={{ fontFamily: F.bodySemi }}>
              Remove
            </T>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable accessibilityRole="button" onPress={onDone} hitSlop={6} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
          <T v="small" color={C.link} style={{ fontFamily: F.bodySemi }}>
            Done
          </T>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: C.lineSoft }} />;
}

export function Spacer() {
  return <View style={{ flex: 1, minHeight: 8 }} />;
}

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Mon…Sun work-day toggles. */
export function WeekdayToggles({ value, onChange }: { value: Weekday[]; onChange: (v: Weekday[]) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
      {ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <Pressable
            key={d}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${DAY_FULL[d]}, ${on ? 'work day' : 'day off'}`}
            onPress={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            style={({ pressed }) => ({
              flex: 1,
              maxWidth: 46,
              height: 54,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: on ? C.harbor : C.chipLine,
              backgroundColor: on ? C.harbor : C.white,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}>
            <T color={on ? C.mint : C.inkMuted} style={{ fontFamily: F.bodyBold, fontSize: 13 }}>
              {DAY_LETTER[d]}
            </T>
            <T color={on ? C.mint : C.inkMuted} style={{ fontFamily: F.bodySemi, fontSize: 9 }}>
              {on ? 'WORK' : 'OFF'}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
