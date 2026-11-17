import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Ring, T } from '@/components/ui';
import { MONTH_SHORT, WEEKDAY_LONG, dayPlan, parseISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { ObScaffold } from '@/features/onboarding/kit';
import { actions, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const TIPS = [
  ['Tap ', '+', ' after you spend. Amount first, the rest is optional.'],
  ['Paid by UPI or an app? Open the receipt, tap ', 'Share → Pace', ", and I'll read it for you."],
  ['Your number changes each morning. ', '', "That's the plan working, not a mistake."],
];

export default function Done() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const plan = dayPlan(profile, entries);
  const first = profile.name.trim().split(/\s+/)[0];
  const d = parseISODate(plan.date);
  const toPayday = plan.daysLeft;
  const kind = plan.weightToday > 1 ? 'a day off' : 'a work day';
  const sub = plan.extraTodayLabel ? `${kind} + ${plan.extraTodayLabel}` : kind;
  const tips = profile.region === 'IN' ? TIPS : TIPS.map((t, i) => (i === 1 ? ['Paid in an app? Open the receipt, tap ', 'Share → Pace', ", and I'll read it for you."] : t));

  const go = () => {
    actions.completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <ObScaffold dark back={false} gap={24} footer={<Button kind="mint" label="Go to Today" onPress={go} />}>
      <View style={{ gap: 8, paddingTop: 12 }}>
        <T v="small" color={C.gold} style={{ fontFamily: F.bodySemi }}>
          {`${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} · ${toPayday === 1 ? 'payday tomorrow' : `${toPayday} days to payday`}`}
        </T>
        <T color={C.onDark} style={{ fontFamily: F.display, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 }}>
          {`You're all set${first ? `, ${first}` : ''}.`}
        </T>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Ring size={250} stroke={18} value={plan.limit > 0 ? 1 : 0} track={C.harborMid}>
          <View style={{ alignItems: 'center', gap: 2, width: 170 }}>
            <T v="label" color={C.onDarkMuted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 11, letterSpacing: 0.6, textAlign: 'center' }}>
              TODAY YOU CAN SPEND
            </T>
            <T v="number" color={C.onDark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {fmt(plan.limit, profile.currency)}
            </T>
            <T v="small" color={C.onDarkMuted} numberOfLines={2} style={{ textAlign: 'center' }}>
              {sub}
            </T>
          </View>
        </Ring>
      </View>

      <View style={{ gap: 10 }}>
        <T v="bodySemi" color={C.onDarkMuted} style={{ fontSize: 14 }}>
          Three things worth knowing
        </T>
        {tips.map(([a, b, c], i) => (
          <Animated.View key={i} entering={FadeInDown.delay(150 + i * 120).duration(450)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: C.harborMid }}>
            <T color={C.mint} style={{ fontFamily: F.displayBold, fontSize: 14 }}>
              {i + 1}
            </T>
            <T v="small" color={C.onDark} style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              {a}
              {b ? (
                <T v="small" color={C.onDark} style={{ fontFamily: F.bodyBold, fontSize: 14 }}>
                  {b}
                </T>
              ) : null}
              {c}
            </T>
          </Animated.View>
        ))}
      </View>
    </ObScaffold>
  );
}
