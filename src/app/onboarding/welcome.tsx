import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PaceMark, Ring, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { applyBackup, pickBackup } from '@/features/backup';
import { useStore } from '@/store';
import { C, F } from '@/theme/tokens';

async function restore() {
  try {
    const b = await pickBackup();
    if (!b) return;
    Alert.alert('Restore this backup?', `It has your plan and ${b.entries} ${b.entries === 1 ? 'entry' : 'entries'}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: () => {
          applyBackup(b);
          router.replace('/');
        },
      },
    ]);
  } catch (e) {
    Alert.alert('Could not restore', e instanceof Error ? e.message : 'That file is not a Pace backup.');
  }
}

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const currency = useStore((s) => s.profile.currency);
  return (
    <View style={{ flex: 1, backgroundColor: C.harbor, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20, paddingHorizontal: 24, gap: 24 }}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <PaceMark size={32} />
        <T color={C.onDark} style={{ fontFamily: F.displayBold, fontSize: 24, letterSpacing: -0.5 }}>
          Pace
        </T>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
        <View style={{ width: 290, height: 290, borderRadius: 145, borderWidth: 1, borderStyle: 'dashed', borderColor: C.harborLine, alignItems: 'center', justifyContent: 'center' }}>
          <Ring size={236} stroke={22} value={0.65} track={C.harborMid}>
            <T v="label" color={C.onDarkMuted} style={{ letterSpacing: 0.8 }} numberOfLines={1} adjustsFontSizeToFit>
              YOU CAN SPEND
            </T>
            <T v="number" color={C.onDark} numberOfLines={1} adjustsFontSizeToFit>
              {fmt(323, currency)}
            </T>
            <T v="small" color={C.onDarkMuted}>
              more today
            </T>
          </Ring>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={{ gap: 12 }}>
        <T color={C.onDark} style={{ fontFamily: F.display, fontSize: 34, lineHeight: 38, letterSpacing: -1 }}>
          One number a day.{'\n'}A month that works.
        </T>
        <T color={C.onDarkMuted} style={{ fontSize: 16, lineHeight: 24 }}>
          Pace sets your bills and savings aside first, then tells you what&apos;s safe to spend today.
        </T>
      </Animated.View>

      <View style={{ gap: 10 }}>
        <Button kind="mint" label="Get started" onPress={() => router.push('/onboarding/how')} />
        <Button kind="onDark" label="Restore from a backup" onPress={restore} />
        <T v="caption" color={C.onDarkMuted} style={{ textAlign: 'center', lineHeight: 18 }}>
          We never ask for bank passwords, UPI PINs or card details.
        </T>
      </View>
    </View>
  );
}
