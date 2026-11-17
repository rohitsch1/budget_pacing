import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Header, Screen, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { mergeIntoExisting, saveFromSession } from '@/features/capture/pipeline';
import { getSession } from '@/features/capture/session';
import { CheckDot, goHome, Thumb, whenLabel } from '@/features/capture/ui';
import { useStore } from '@/store';
import { C, F } from '@/theme/tokens';

export default function ShareDuplicate() {
  const { sid } = useLocalSearchParams<{ sid?: string }>();
  const session = getSession(sid);
  const entries = useStore((s) => s.entries);
  const existing = session?.duplicateId ? entries.find((e) => e.id === session.duplicateId) : undefined;

  if (!session || !existing) {
    return (
      <Screen footer={<Button label="Back to today" onPress={goHome} />}>
        <Header close title="Shared to Pace" onBack={goHome} />
        <T v="body" color={C.inkMuted}>
          This receipt has already been handled.
        </T>
      </Screen>
    );
  }

  const p = session.parsed;
  const amount = p.amount ?? existing.amount;
  const sameRef = !!(p.ref && existing.ref && p.ref.slice(-4) === existing.ref.slice(-4));
  const mins = p.at ? Math.round(Math.abs(new Date(p.at).getTime() - new Date(existing.at).getTime()) / 60000) : null;
  const why = [
    `Same amount, ${fmt(amount, p.currency)}`,
    sameRef ? `Same reference number, ••${p.ref!.slice(-4)}` : null,
    mins !== null && isFinite(mins) ? (mins < 1 ? 'Paid at the same minute' : `Paid ${mins} minute${mins === 1 ? '' : 's'} apart`) : null,
  ].filter(Boolean) as string[];

  const cards = [
    {
      src: `Added earlier · ${existing.app ? existing.app + ' receipt' : existing.source === 'manual' ? 'typed in by you' : 'receipt'}`,
      payee: existing.payee || existing.note || existing.category,
      meta: `${whenLabel(existing.at)}${existing.ref ? ` · ref ••${existing.ref.slice(-4)}` : ''}`,
      amount: existing.amount,
      currency: existing.currency,
      uri: null as string | null,
      thumb: '#E9F1EC',
    },
    {
      src: `Just shared · ${p.app ?? 'receipt'}`,
      payee: p.payee || 'Payee not shown',
      meta: `${whenLabel(p.at)}${p.ref ? ` · ref ••${p.ref.slice(-4)}` : ''}`,
      amount,
      currency: p.currency,
      uri: session.imageUri ?? null,
      thumb: '#E6EAF3',
    },
  ];

  const keepOne = () => {
    mergeIntoExisting(session.id, existing.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    goHome();
  };
  const addBoth = () => {
    if (p.direction === 'in') {
      router.replace({ pathname: '/share/received', params: { sid: session.id } });
      return;
    }
    if (p.amount === null) {
      router.replace({ pathname: '/import/confirm', params: { sid: session.id } });
      return;
    }
    saveFromSession(session.id, { amount: p.amount });
    goHome();
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label="Same payment, keep one" onPress={keepOne} />
          <Button kind="secondary" label="Two different payments, add both" onPress={addBoth} />
        </>
      }>
      <Header close title="Shared to Pace" onBack={goHome} />

      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 6 }}>
        <T v="h1" style={{ fontSize: 26, lineHeight: 30 }}>
          Same payment, shared twice?
        </T>
        <T v="body" color={C.inkMuted} style={{ fontSize: 14 }}>
          These two receipts look like one payment. We won&apos;t count it twice unless you tell us to.
        </T>
      </Animated.View>

      <View style={{ gap: 10 }}>
        {cards.map((c, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(150 + i * 300).duration(400)}
            style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {c.uri ? (
              <Thumb uri={c.uri} w={40} h={52} />
            ) : (
              <View style={{ width: 40, height: 52, borderRadius: 8, backgroundColor: c.thumb, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.success }} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <T v="caption" color={C.link} style={{ fontFamily: F.bodyBold }}>
                {c.src}
              </T>
              <T v="bodySemi" numberOfLines={1}>
                {c.payee}
              </T>
              <T v="caption" color={C.inkMuted}>
                {c.meta}
              </T>
            </View>
            <T v="h3" style={{ fontFamily: F.display, fontSize: 18 }}>
              {fmt(c.amount, c.currency)}
            </T>
          </Animated.View>
        ))}
      </View>

      <View style={{ backgroundColor: C.amberSoft, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
        <T v="small" color={C.amberInk} style={{ fontFamily: F.bodyBold }}>
          Why we think they match
        </T>
        {why.map((w) => (
          <View key={w} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CheckDot />
            <T v="body" color={C.amberInk} style={{ fontSize: 14 }}>
              {w}
            </T>
          </View>
        ))}
      </View>

      <T v="small" color={C.inkMuted} style={{ paddingHorizontal: 4 }}>
        If you keep one, Pace combines the clearest details: it fills in the shop name, account and reference wherever the earlier one was missing them.
      </T>
    </Screen>
  );
}
