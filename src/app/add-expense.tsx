import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Chip, Header, Icon, Keypad, Screen, T } from '@/components/ui';
import { addDays, todayISO } from '@/domain/budget';
import type { Entry } from '@/domain/types';
import { impactOf, localNowISO } from '@/features/capture/pipeline';
import { ImpactPill, TextLink, typedAmount } from '@/features/capture/ui';
import { actions, useStore } from '@/store';
import { C, CATEGORIES, F, R } from '@/theme/tokens';

type Method = { label: string; tag?: Entry['methodTag'] };
const METHODS_IN: Method[] = [{ label: 'UPI', tag: 'Bank' }, { label: 'Card', tag: 'Debit' }, { label: 'Cash', tag: 'Cash' }];
const METHODS_US: Method[] = [{ label: 'Card', tag: 'Debit' }, { label: 'Cash', tag: 'Cash' }, { label: 'App', tag: 'Wallet' }];
const WHEN = ['Now', 'Yesterday'] as const;

export default function AddExpense() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const currency = profile.currency;
  const methods = profile.region === 'IN' ? METHODS_IN : METHODS_US;

  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState<string>('Food');
  const [note, setNote] = useState('');
  const [mi, setMi] = useState(0);
  const [wi, setWi] = useState(0);
  const [picking, setPicking] = useState(false);

  const n = parseFloat(amt || '0') || 0;
  const yesterdayAt = `${addDays(todayISO(), -1)}T20:00:00`;
  // recomputed every render (cheap); `entries` subscription keeps it live
  void entries;
  const { after } = impactOf({ kind: 'expense', amount: n, at: wi === 0 ? null : yesterdayAt });

  const save = () => {
    if (!n) return;
    const m = methods[mi];
    actions.addEntry({
      kind: 'expense',
      amount: n,
      currency,
      category: cat,
      note: note.trim() || undefined,
      method: m.label,
      methodTag: m.tag,
      source: 'manual',
      at: wi === 0 ? localNowISO() : yesterdayAt,
      countsToBudget: true,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const fromScreenshot = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!res.canceled && res.assets[0]?.uri) {
        router.push({ pathname: '/import/scan', params: { uri: res.assets[0].uri } });
      }
    } catch {
      // picker unavailable — the keypad is still here
    } finally {
      setPicking(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Keypad value={amt} onChange={setAmt} />
          <Button label={n ? 'Save' : 'Enter an amount'} disabled={!n} onPress={save} />
        </>
      }>
      <Header
        title="Add expense"
        close
        right={
          <Pressable
            accessibilityRole="button"
            onPress={fromScreenshot}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              height: 40,
              paddingHorizontal: 14,
              borderRadius: R.pill,
              borderWidth: 1,
              borderColor: C.btnLine,
              backgroundColor: C.white,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}>
            <Icon name="image" size={16} />
            <T v="small" style={{ fontFamily: F.bodySemi }}>
              From screenshot
            </T>
          </Pressable>
        }
      />

      <View style={{ alignItems: 'center', gap: 6, paddingTop: 4 }}>
        <T v="display" color={n ? C.ink : C.inkDisabled} accessibilityLabel={`Amount ${typedAmount(amt, currency)}`}>
          {typedAmount(amt, currency)}
        </T>
        <ImpactPill left={after.left} currency={currency} empty={!n} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={c === cat} onPress={() => setCat(c)} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What was it? (optional)"
          placeholderTextColor={C.inkFaint}
          accessibilityLabel="Note"
          returnKeyType="done"
          style={{
            flex: 1,
            height: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            fontFamily: F.body,
            fontSize: 14,
            color: C.ink,
          }}
        />
        <SmallToggle label={methods[mi].label} a11y="Payment method" onPress={() => setMi((mi + 1) % methods.length)} />
        <SmallToggle label={WHEN[wi]} a11y="When" onPress={() => setWi((wi + 1) % WHEN.length)} />
      </View>

      <View style={{ alignItems: 'center' }}>
        <TextLink label="Paid in another app? Share the receipt to Pace" onPress={() => router.push('/share/how-to')} />
      </View>
    </Screen>
  );
}

function SmallToggle({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y}: ${label}. Tap to change`}
      onPress={onPress}
      style={{ height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, justifyContent: 'center' }}>
      <T v="small" style={{ fontFamily: F.bodySemi }}>
        {label}
      </T>
    </Pressable>
  );
}
