import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Header, Screen, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import type { Entry, EntryKind } from '@/domain/types';
import { finishSession, impactOf, saveFromSession } from '@/features/capture/pipeline';
import { getSession } from '@/features/capture/session';
import { goHome, whenLabel } from '@/features/capture/ui';
import { useStore } from '@/store';
import { C, F } from '@/theme/tokens';

type Pick = 'back' | 'refund' | 'income' | 'skip';
const OPTS: { k: Pick; t: string; s: string }[] = [
  { k: 'back', t: 'Someone paying me back', s: 'For a bill you split or covered' },
  { k: 'refund', t: 'A refund', s: 'Cancels part of something you bought' },
  { k: 'income', t: 'Extra income', s: 'Bonus, gift, side job' },
  { k: 'skip', t: "Don't record it", s: 'Moving money between my own accounts' },
];

export default function ShareReceived() {
  const { sid } = useLocalSearchParams<{ sid?: string }>();
  const session = getSession(sid);
  const entries = useStore((s) => s.entries);
  const [pick, setPick] = useState<Pick>('back');
  const [refundOf, setRefundOf] = useState<Entry | null>(null);

  if (!session || session.parsed.amount === null) {
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
  const amount = p.amount as number;
  const cur = p.currency;
  const money = fmt(amount, cur);
  const incoming = p.direction === 'in';
  const kind: EntryKind = pick === 'refund' ? 'refund' : pick === 'income' ? 'income' : 'payback';
  const { before, after } = impactOf(pick === 'skip' ? null : { kind, amount, at: p.at });
  const perDay = after.perWorkDay - before.perWorkDay;

  const recent = entries.filter((e) => e.kind === 'expense').slice(0, 6);

  let impact: string;
  let cta: string;
  switch (pick) {
    case 'back':
      impact =
        perDay > 0
          ? `${money} goes back into this month. Every day left gets ${fmt(perDay, cur)} more, so today becomes ${fmt(after.left, cur)} left.`
          : `${money} goes back into this month, so today becomes ${fmt(after.left, cur)} left.`;
      cta = `Add ${money} back`;
      break;
    case 'refund':
      impact = refundOf
        ? `Your ${fmt(refundOf.amount, refundOf.currency)} ${refundOf.payee || refundOf.category} spend shrinks by ${money}. Today becomes ${fmt(after.left, cur)} left.`
        : `Next, pick the purchase it refunds. That spend shrinks by ${money}.`;
      cta = refundOf || !recent.length ? `Add ${money} refund` : 'Choose the purchase';
      break;
    case 'income':
      impact = `Recorded as income. It adds to what you can spend this month: today becomes ${fmt(after.left, cur)} left.`;
      cta = 'Add as income';
      break;
    default:
      impact = 'Nothing changes. Pace forgets this screenshot.';
      cta = 'Done';
  }

  const done = () => {
    if (pick === 'skip') {
      finishSession(session.id);
      goHome();
      return;
    }
    if (pick === 'refund' && !refundOf && recent.length) return; // choose from the list first
    saveFromSession(session.id, {
      kind,
      amount,
      category: pick === 'refund' && refundOf ? refundOf.category : 'Income',
      note: pick === 'refund' && refundOf ? `Refund · ${refundOf.payee || refundOf.note || refundOf.category}` : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    goHome();
  };

  const meta = [p.payee ? `${incoming ? 'from' : 'to'} ${p.payee}` : null, p.note ? `“${p.note}”` : null, whenLabel(p.at).replace('Today', 'today')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen scroll footer={<Button label={cta} disabled={pick === 'refund' && !refundOf && recent.length > 0} onPress={done} />}>
      <Header close title="Shared to Pace" onBack={goHome} />

      <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: C.mintSoft, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.ok, alignItems: 'center', justifyContent: 'center' }}>
          <T v="h2" color={C.white}>
            ↓
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="label" color={C.ok}>
            {`${incoming ? 'RECEIVED' : 'NOT SPENDING'}${p.app ? ' · ' + p.app.toUpperCase() : ''}`}
          </T>
          <T v="h1" style={{ fontSize: 32, lineHeight: 36 }}>
            {fmt(amount, cur, { sign: true })}
          </T>
          <T v="small" color="#33544A">
            {meta}
          </T>
        </View>
      </Animated.View>

      <View style={{ gap: 4 }}>
        <T v="h2">{incoming ? 'Money came in, not out' : 'Not spending? Tell us what it was'}</T>
        <T v="body" color={C.inkMuted} style={{ fontSize: 14 }}>
          So it won&apos;t count as spending. What was it?
        </T>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="What was this money" style={{ gap: 8 }}>
        {OPTS.map((o) => {
          const on = o.k === pick;
          return (
            <Pressable
              key={o.k}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setPick(o.k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: on ? 2 : 1, borderColor: on ? C.harbor : C.line, backgroundColor: C.white }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.harbor : C.inkDisabled, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.harbor }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodySemi">{o.t}</T>
                <T v="caption" color={C.inkMuted}>
                  {o.s}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>

      {pick === 'refund' && recent.length ? (
        <View style={{ gap: 6 }}>
          <T v="label" color={C.inkMuted}>
            WHICH PURCHASE?
          </T>
          {recent.map((e) => {
            const on = refundOf?.id === e.id;
            return (
              <Pressable
                key={e.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setRefundOf(e)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? C.harbor : C.line, backgroundColor: C.white }}>
                <View style={{ flex: 1 }}>
                  <T v="bodySemi" numberOfLines={1} style={{ fontSize: 14 }}>
                    {e.payee || e.note || e.category}
                  </T>
                  <T v="caption" color={C.inkMuted}>
                    {whenLabel(e.at)}
                  </T>
                </View>
                <T v="bodySemi" style={{ fontFamily: F.display }}>
                  {fmt(e.amount, e.currency)}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ backgroundColor: C.harbor, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, gap: 4 }}>
        <T v="label" color={C.mint}>
          WHAT CHANGES
        </T>
        <T v="bodySemi" color={C.onDark}>
          {impact}
        </T>
      </View>
    </Screen>
  );
}
