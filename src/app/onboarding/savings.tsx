import { Pressable, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { dayPlan, planTotals } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { useDraft } from '@/features/onboarding/draft';
import { AmountInput, Bubble, ObScaffold, SkipLink, useObFlow } from '@/features/onboarding/kit';
import { cycleInfo, defaultUsual } from '@/features/onboarding/logic';
import { actions, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const PCTS = [5, 10, 15, 20];

export default function Savings() {
  const profile = useStore((s) => s.profile);
  const draft = useDraft();
  const flow = useObFlow('/onboarding/start');
  const cur = profile.currency;
  const t = planTotals(profile);
  const step = cur === 'INR' ? 500 : 50;
  const opts = PCTS.map((p) => ({ p, a: Math.max(step, Math.round((t.income * p) / 100 / step) * step) }));
  const s = profile.savingsMonthly;

  // Full-cycle numbers for this savings amount (as if the cycle just started, nothing spent yet)
  const { cycle } = cycleInfo(profile);
  const plan = dayPlan({ ...profile, start: null }, [], cycle.start);
  const usual = draft.usualWorkDay ?? defaultUsual(profile.region).work;
  const gap = plan.perWorkDay - usual;
  const verdict =
    t.flexible <= 0
      ? 'This leaves nothing for day-to-day spending. Try a smaller amount for now; you can raise it later.'
      : gap >= usual * 0.1
        ? 'Comfortable. You’ll have room for the odd treat.'
        : gap >= 0
          ? 'Balanced. Your usual days fit, with a little breathing room.'
          : 'Tight. A normal day costs more than this, so you’d need to trim a little.';

  const essentials = t.bills + t.emis + t.routine;
  const target = essentials * 3;
  const saved = profile.savedSoFar ?? 0;
  const toGo = Math.max(0, target - saved);

  return (
    <ObScaffold
      chapter="YOUR CUSHION"
      gap={12}
      right={flow.isEdit ? null : <SkipLink onPress={flow.skip} />}
      footer={<Button label={flow.isEdit ? 'Save' : s > 0 ? `Protect ${fmt(s, cur)} a month` : 'Continue without saving'} onPress={flow.go} />}>
      <Bubble>Before I work out your daily number, let&apos;s pay future-you first. How much should I protect each month? Watch how it changes your day.</Bubble>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {opts.map((o) => {
          const on = o.a === s;
          return (
            <Pressable
              key={o.p}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => actions.updateProfile({ savingsMonthly: o.a })}
              style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: on ? C.harbor : C.chipLine, backgroundColor: on ? '#E6F6EE' : C.white }}>
              <T style={{ fontFamily: F.display, fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit>
                {fmt(o.a, cur)}
              </T>
              <T v="caption" color={C.inkMuted} style={{ fontSize: 11 }}>
                {`${o.p}%`}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ gap: 6 }}>
        <T v="caption" color={C.inkMuted}>
          Or type your own amount
        </T>
        <AmountInput label="Monthly savings" value={s || null} onChange={(v) => actions.updateProfile({ savingsMonthly: v ?? 0 })} currency={cur} />
      </View>

      <View style={{ backgroundColor: C.harbor, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <T v="label" color={C.onDarkMuted}>
            YOUR WORK-DAY NUMBER
          </T>
          <T color={C.mint} style={{ fontFamily: F.display, fontSize: 26 }}>
            {fmt(plan.perWorkDay, cur)}
          </T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <T v="small" color={C.onDarkMuted}>
            {`Day off ${fmt(plan.perWeekendDay, cur)}`}
          </T>
          <T v="small" color={C.onDarkMuted}>
            {`Usual day costs ${fmt(usual, cur)}`}
          </T>
        </View>
        <T v="small" color={C.onDark}>
          {verdict}
        </T>
      </View>

      {essentials > 0 ? (
        <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, gap: 4 }}>
          <T v="bodySemi">A good first goal</T>
          <T v="small" color={C.inkMuted}>
            {toGo <= 0
              ? `An emergency fund of ${fmt(target, cur)}, about 3 months of bills, EMIs and routine. The ${fmt(saved, cur)} you've already saved covers it. Nice.`
              : `An emergency fund of ${fmt(target, cur)}, about 3 months of bills, EMIs and routine.${
                  saved > 0 ? ` You already have ${fmt(saved, cur)}, so ${fmt(toGo, cur)} to go.` : ''
                }${s > 0 ? ` At ${fmt(s, cur)} a month you'd get there in about ${Math.ceil(toGo / s)} ${Math.ceil(toGo / s) === 1 ? 'month' : 'months'}.` : ''}`}
          </T>
        </View>
      ) : null}
    </ObScaffold>
  );
}
