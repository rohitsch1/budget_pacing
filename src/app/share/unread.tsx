import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Header, Keypad, Screen, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { finishSession, impactOf, saveFromSession } from '@/features/capture/pipeline';
import { getSession } from '@/features/capture/session';
import { CategoryPicker, CheckDot, goHome, ImpactPill, TextLink, Thumb, typedAmount } from '@/features/capture/ui';
import { useStore } from '@/store';
import { C, F } from '@/theme/tokens';

export default function ShareUnread() {
  const { sid } = useLocalSearchParams<{ sid?: string }>();
  const session = getSession(sid);
  const home = useStore((s) => s.profile.currency);
  const entries = useStore((s) => s.entries);
  const p = session?.parsed;
  const currency = p?.currency ?? home;
  const failed = p?.direction === 'failed';

  const [amt, setAmt] = useState('');
  const [category, setCategory] = useState<string>(p?.category ?? 'Other');
  const n = parseFloat(amt || '0') || 0;
  void entries;
  const { after } = impactOf({ kind: 'expense', amount: n, at: p?.at });

  // chips: everything except the amount (which we either didn't find or don't trust)
  const found = (p?.found ?? []).filter((f) => !/^[₹$€£]/.test(f));

  const save = () => {
    if (!n) return;
    saveFromSession(session?.id, { amount: n, category });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    goHome();
  };
  const tryAnother = () => {
    finishSession(session?.id);
    router.replace('/import/scan');
  };
  const close = () => goHome();

  const title = failed ? "This payment didn't go through" : "We couldn't find the amount";
  const body = failed
    ? `Failed payments aren't counted${p?.amount ? ` (${fmt(p.amount, currency)})` : ''}. If money did leave your account, type it below.`
    : session?.imageUri
      ? 'The screenshot may be cropped or blurry. Type the amount and we’ll do the rest.'
      : 'We couldn’t read that. Type the amount and we’ll do the rest.';

  return (
    <Screen
      footer={
        <>
          <Keypad value={amt} onChange={setAmt} />
          <Button label={n ? `Save ${fmt(n, currency)}${p?.payee ? ` to ${p.payee}` : ''}` : 'Enter an amount'} disabled={!n} onPress={save} />
        </>
      }>
      <Header close title="Shared to Pace" onBack={close} right={<TextLink label="Try another" onPress={tryAnother} />} />

      <Animated.View entering={FadeInDown.duration(400)} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.amberSoft, borderRadius: 18, padding: 14 }}>
        {session?.imageUri ? (
          <Thumb uri={session.imageUri} w={54} h={76} />
        ) : (
          <View style={{ width: 54, height: 76, borderRadius: 10, backgroundColor: C.white, padding: 8, gap: 5 }}>
            <View style={{ height: 5, width: '70%', borderRadius: 3, backgroundColor: '#D5D5D5' }} />
            <View style={{ height: 5, width: '90%', borderRadius: 3, backgroundColor: '#D5D5D5' }} />
            <View style={{ height: 5, width: '50%', borderRadius: 3, backgroundColor: '#D5D5D5' }} />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <T v="bodySemi" color={C.amberInk} style={{ fontFamily: F.bodyBold, fontSize: 16 }}>
            {title}
          </T>
          <T v="small" color={C.amberInk}>
            {body}
          </T>
        </View>
      </Animated.View>

      {found.length ? (
        <View style={{ gap: 6 }}>
          <T v="label" color={C.inkMuted}>
            WHAT WE DID FIND
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {found.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
                <CheckDot size={14} bg="transparent" fg={C.ok} />
                <T v="small" style={{ fontFamily: F.bodySemi }}>
                  {f}
                </T>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ alignItems: 'center', gap: 6, paddingTop: 4 }}>
        <T v="display" style={{ fontSize: 52, lineHeight: 56 }} color={n ? C.ink : C.inkDisabled}>
          {typedAmount(amt, currency)}
        </T>
        <ImpactPill left={after.left} currency={currency} empty={!n} />
      </View>

      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CategoryPicker value={category} onChange={setCategory} small />
      </ScrollView>
    </Screen>
  );
}
