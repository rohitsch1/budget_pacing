import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button, Icon, Pill, Screen, T } from '@/components/ui';
import { C } from '@/theme/tokens';

/** Everything listed here exists in the app today. Pace Plus is free for everyone during early access. */
const PERKS = [
  { t: 'Full insights and past cycles', s: 'See where your money went, cycle by cycle' },
  { t: 'Goals and planned purchases', s: 'Pace sets a little aside each month so they are ready on time' },
  { t: 'Your own categories', s: 'Add, rename or remove categories to match your life' },
  { t: 'CSV export and backup', s: 'Take your spending to a spreadsheet, or back up and restore everything' },
  { t: 'Screenshot and share import', s: 'Share a payment screenshot to Pace instead of typing it' },
];

export default function Paywall() {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen dark scroll footer={<Button kind="mint" label="Got it" onPress={close} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={close} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }}>
          <Icon name="close" color={C.onDark} />
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Pill label="PACE PLUS" bg={C.mint} fg={C.harbor} />
        <T v="h1" color={C.onDark} style={{ fontSize: 30, lineHeight: 33, letterSpacing: -0.8 }}>
          Pace Plus is free while Pace is in early access
        </T>
        <T v="body" color={C.onDarkMuted}>
          Everything below is already switched on for you. Nothing to buy, no trial, no card.
        </T>
      </View>

      <View style={{ gap: 12 }}>
        {PERKS.map((p) => (
          <View key={p.t} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.harborMid, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={14} color={C.mint} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodySemi" color={C.onDark}>
                {p.t}
              </T>
              <T v="small" color={C.onDarkMuted}>
                {p.s}
              </T>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
