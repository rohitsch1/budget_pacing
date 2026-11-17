import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Icon, T } from '@/components/ui';
import { ObScaffold, Spacer } from '@/features/onboarding/kit';
import { C, F } from '@/theme/tokens';

const STEPS = [
  {
    t: "We set aside what's already spoken for",
    s: 'Rent, EMIs, bills and your savings go into a locked box first, so you never spend them by accident.',
    art: 'split' as const,
  },
  {
    t: "What's left becomes one daily number",
    s: 'Shaped by your real calendar, so weekends and office days each get what they usually need.',
    art: 'week' as const,
  },
  {
    t: 'Off-days are fine. Tomorrow adjusts.',
    s: 'Spend more today and we quietly spread it over the days ahead. No red alerts, no guilt.',
    art: null,
  },
];

function Art({ kind }: { kind: 'split' | 'week' | null }) {
  if (kind === 'split')
    return (
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {[
          [20, C.inkMuted],
          [13, '#8FA0A3'],
          [10, C.link],
          [25, C.mint],
        ].map(([f, c], i) => (
          <View key={i} style={{ flex: f as number, height: 8, borderRadius: 4, backgroundColor: c as string }} />
        ))}
      </View>
    );
  if (kind === 'week')
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 28, marginTop: 4 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={{ flex: 1, height: i >= 5 ? 28 : 16, borderRadius: 3, backgroundColor: i >= 5 ? C.mint : '#CFE9DD' }} />
        ))}
      </View>
    );
  return null;
}

export default function How() {
  return (
    <ObScaffold
      gap={12}
      footer={
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.linkSoft }}>
            <Icon name="lock" size={18} color={C.link} />
            <T v="small" style={{ flex: 1 }}>
              You type in rough amounts. We never connect to your bank or ask for passwords.
            </T>
          </View>
          <Button label="Sounds good, let's begin" onPress={() => router.push('/onboarding/hello')} />
        </>
      }>
      <View style={{ gap: 8, marginBottom: 6 }}>
        <T v="small" color={C.link} style={{ fontFamily: F.bodySemi }}>
          Before we start
        </T>
        <T v="h1">Here&apos;s how Pace looks after your money</T>
      </View>
      {STEPS.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(100 + i * 120).duration(450)}
          style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 14 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.harbor, alignItems: 'center', justifyContent: 'center' }}>
            <T color={C.mint} style={{ fontFamily: F.displayBold, fontSize: 18 }}>
              {i + 1}
            </T>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <T v="bodySemi" style={{ fontSize: 16 }}>
              {s.t}
            </T>
            <T v="small" color={C.inkMuted} style={{ fontSize: 14, lineHeight: 21 }}>
              {s.s}
            </T>
            <Art kind={s.art} />
          </View>
        </Animated.View>
      ))}
      <Spacer />
    </ObScaffold>
  );
}
