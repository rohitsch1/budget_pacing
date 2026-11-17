import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Button, Icon, T } from '@/components/ui';
import { planTotals } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { ObScaffold } from '@/features/onboarding/kit';
import { cycleInfo } from '@/features/onboarding/logic';
import { useStore } from '@/store';
import { C } from '@/theme/tokens';

const STEP_MS = 520;

export default function Building() {
  const profile = useStore((s) => s.profile);
  const reduce = useReducedMotion();
  const cur = profile.currency;
  const t = planTotals(profile);
  const info = cycleInfo(profile);
  const first = profile.name.trim().split(/\s+/)[0];

  const steps: string[] = [];
  if (t.emis) steps.push(`Setting aside ${fmt(t.emis, cur)} for ${profile.emis.length === 1 ? 'your EMI' : `your ${profile.emis.length} EMIs`}`);
  if (t.bills) steps.push(`Reserving ${fmt(t.bills, cur)} for ${profile.bills.some((b) => b.name === 'Rent') ? 'rent and bills' : 'your bills'}`);
  if (t.routine) steps.push(`Locking away ${fmt(t.routine, cur)} of monthly routine`);
  if (t.savings) steps.push(`Protecting ${fmt(t.savings, cur)} for future-you`);
  steps.push(`Mapping ${info.work} work days and ${info.off} days off`);
  if (profile.dayExtras.length) steps.push(`Making room for ${profile.dayExtras.map((x) => x.label).join(', ')}`);
  steps.push('Working out your daily number');

  const [done, setDone] = useState(0);
  const finished = done >= steps.length;

  useEffect(() => {
    if (finished) {
      const id = setTimeout(() => router.replace('/onboarding/summary'), reduce ? 400 : 900);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setDone((d) => d + 1), reduce ? 200 : STEP_MS);
    return () => clearTimeout(id);
  }, [done, finished, reduce]);

  const spin = useSharedValue(0);
  useEffect(() => {
    if (!reduce) spin.set(withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false));
  }, [reduce, spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  return (
    <ObScaffold
      dark
      back={false}
      gap={28}
      footer={<Button kind="mint" label="See my plan" disabled={!finished} onPress={() => router.replace('/onboarding/summary')} />}>
      <View style={{ alignItems: 'center', paddingTop: 28 }}>
        <View style={{ width: 150, height: 150 }}>
          <Svg width={150} height={150} viewBox="0 0 112 112">
            <Circle cx={56} cy={56} r={46} fill="none" stroke={C.harborMid} strokeWidth={10} />
            <Circle
              cx={56}
              cy={56}
              r={46}
              fill="none"
              stroke={C.mint}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${(289 * Math.min(done, steps.length)) / steps.length} 289`}
              transform="rotate(-90 56 56)"
            />
            <Circle cx={56} cy={56} r={30} fill="none" stroke={C.harborMid} strokeWidth={6} />
          </Svg>
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, spinStyle]}>
            <Svg width={150} height={150} viewBox="0 0 112 112">
              <Circle cx={56} cy={56} r={30} fill="none" stroke={C.gold} strokeWidth={6} strokeLinecap="round" strokeDasharray="70 189" />
            </Svg>
          </Animated.View>
        </View>
      </View>

      <View style={{ gap: 8, alignItems: 'center' }}>
        <T v="h1" color={C.onDark} style={{ fontSize: 26, textAlign: 'center' }}>
          Putting your plan together
        </T>
        <T v="small" color={C.onDarkMuted} style={{ fontSize: 14 }}>
          {`This takes a few seconds${first ? `, ${first}` : ''}.`}
        </T>
      </View>

      <View style={{ gap: 14 }}>
        {steps.slice(0, Math.min(done + 1, steps.length)).map((s, i) => {
          const ok = i < done;
          return (
            <Animated.View key={s} entering={FadeInDown.duration(350)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {ok ? (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={14} color={C.harbor} strokeWidth={3} />
                </View>
              ) : (
                <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={C.mint} />
                </View>
              )}
              <T v="body" color={ok ? C.onDark : C.onDarkMuted} style={{ flex: 1 }}>
                {s}
              </T>
            </Animated.View>
          );
        })}
      </View>
    </ObScaffold>
  );
}
