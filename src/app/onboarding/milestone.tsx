import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Icon, Pill, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { useDraft } from '@/features/onboarding/draft';
import { ObScaffold, SkipLink } from '@/features/onboarding/kit';
import { CURRENCY_WORD, describeWorkDays, frequencyLabel, onThe, sumAmounts } from '@/features/onboarding/logic';
import { actions, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const NEXT = ['Bills and subscriptions', 'Loans and EMIs', 'Routine costs like groceries', 'Your week and what you save'];

const WORK: Record<string, string> = { sal: 'salaried', free: 'freelance', self: 'self-employed', biz: 'business owner', other: '' };

export default function Milestone() {
  const profile = useStore((s) => s.profile);
  const draft = useDraft();
  const first = profile.name.trim().split(/\s+/)[0];

  const income = sumAmounts(profile.incomes);
  const work = draft.workType ? WORK[draft.workType] : '';
  const facts = [
    `Budgeting in ${CURRENCY_WORD[profile.currency]}, ${profile.country}`,
    `${(profile.payFrequency ?? 'monthly') === 'monthly' ? `Payday ${onThe(profile.payday).toLowerCase()}` : `Paid ${frequencyLabel(profile).toLowerCase()}`}${work ? `, ${work}` : ''}`,
    `Working ${describeWorkDays(profile.workDays)}`,
    `${fmt(income, profile.currency)} coming in each month`,
  ];

  const finishLater = () => {
    actions.completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <ObScaffold
      dark
      back={false}
      gap={22}
      footer={
        <>
          <Button kind="mint" label="Keep going" onPress={() => router.push('/onboarding/bills')} />
          <View style={{ alignItems: 'center' }}>
            <SkipLink dark label="Save and finish later" onPress={finishLater} />
          </View>
        </>
      }>
      <View style={{ gap: 10, paddingTop: 16 }}>
        <Pill label="NICE PROGRESS" bg={C.gold} fg="#3A2A05" />
        <T color={C.onDark} style={{ fontFamily: F.display, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 }}>
          {`Nice work${first ? `, ${first}` : ''}. Your plan is taking shape.`}
        </T>
        <T v="body" color={C.onDarkMuted}>
          You&apos;ve told me what comes in. A little more and you&apos;ll see the one number that runs your month.
        </T>
      </View>

      <View style={{ backgroundColor: C.harborMid, borderRadius: 22, padding: 18, gap: 14 }}>
        <T v="label" color={C.onDarkMuted} style={{ letterSpacing: 0.6 }}>
          WHAT I KNOW SO FAR
        </T>
        {facts.map((f, i) => (
          <Animated.View key={f} entering={FadeInDown.delay(150 + i * 140).duration(400)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={14} color={C.harbor} strokeWidth={3} />
            </View>
            <T v="small" color={C.onDark} style={{ flex: 1, fontSize: 14 }}>
              {f}
            </T>
          </Animated.View>
        ))}
      </View>

      <View style={{ gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.harborSoft }}>
        <T v="label" color={C.onDarkMuted} style={{ letterSpacing: 0.6 }}>
          STILL TO GO, ABOUT 2 MINUTES
        </T>
        {NEXT.map((n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />
            <T v="small" color={C.onDark} style={{ flex: 1, fontSize: 14 }}>
              {n}
            </T>
          </View>
        ))}
      </View>
    </ObScaffold>
  );
}
