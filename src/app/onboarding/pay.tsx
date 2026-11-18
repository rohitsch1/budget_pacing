import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, T } from '@/components/ui';
import { addDays, nextPayday, prettyDate, todayISO } from '@/domain/budget';
import type { PayFrequency, Weekday } from '@/domain/types';
import { type WorkType, updateDraft, useDraft } from '@/features/onboarding/draft';
import { Bubble, DueDayInput, ObScaffold, Question, Reply, Segmented, WeekdayToggles, useObFlow } from '@/features/onboarding/kit';
import { DateField } from '@/features/onboarding/time';
import { describeWorkDays, ordinal } from '@/features/onboarding/logic';
import { actions, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const TYPES: { id: WorkType; n: string; s: string; r: string }[] = [
  { id: 'sal', n: 'Salaried', s: 'Fixed monthly pay', r: 'Salaried, steady pay. I’ll plan around one fixed payday.' },
  { id: 'free', n: 'Freelancer', s: 'Project payments', r: 'Freelance income comes in waves. On the next screen, switch on “My income changes month to month” and I’ll plan on a lower month and treat extra as a bonus.' },
  { id: 'self', n: 'Self-employed', s: 'Professional, contractor', r: 'I’ll help you pay yourself a steady “salary” from what comes in.' },
  { id: 'biz', n: 'Business owner', s: 'Shop, firm, startup', r: 'We’ll only count what you take home from the business, not its turnover.' },
  { id: 'other', n: 'Something else', s: 'Student, retired, mixed', r: 'No problem. We’ll build it from whatever actually comes in.' },
];

const MON_FRI: Weekday[] = [1, 2, 3, 4, 5];
const MON_SAT: Weekday[] = [1, 2, 3, 4, 5, 6];
const same = (a: Weekday[], b: Weekday[]) => a.length === b.length && b.every((d) => a.includes(d));

export default function Pay() {
  const profile = useStore((s) => s.profile);
  const draft = useDraft();
  const flow = useObFlow('/onboarding/income');
  const payday = profile.payday;
  const [other, setOther] = useState(payday !== 1 && payday < 31);
  const sel = TYPES.find((t) => t.id === draft.workType);

  const freq: PayFrequency = profile.payFrequency ?? 'monthly';
  const today = todayISO();

  // Only the explicit income toggle (next screen) sets irregularIncome.
  const pickType = (t: WorkType) => updateDraft({ workType: t });
  const setFreq = (f: PayFrequency) =>
    actions.updateProfile({ payFrequency: f, payAnchor: f === 'monthly' ? profile.payAnchor ?? null : profile.payAnchor ?? today });
  const setPayday = (d: number) =>
    actions.updateProfile({ payday: d, incomes: profile.incomes.map((x) => (x.id === 'inc_salary' ? { ...x, dueDay: d } : x)) });
  const daysMode = same(profile.workDays, MON_FRI) ? 'fri' : same(profile.workDays, MON_SAT) ? 'sat' : 'custom';

  return (
    <ObScaffold chapter="MONEY IN" footer={<Button label={flow.label('Continue')} onPress={flow.go} />}>
      <Bubble>Let&apos;s talk about money coming in. First, what kind of work do you do? It changes how steady I assume your income is.</Bubble>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((t) => {
          const on = t.id === draft.workType;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => pickType(t.id)}
              style={({ pressed }) => ({
                width: '48.5%',
                minHeight: 64,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: on ? C.harbor : C.chipLine,
                backgroundColor: on ? '#E6F6EE' : C.white,
                gap: 2,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}>
              <T v="bodySemi">{t.n}</T>
              <T v="caption" color={C.inkMuted}>
                {t.s}
              </T>
            </Pressable>
          );
        })}
      </View>

      {sel ? <Reply k={sel.id}>{sel.r}</Reply> : null}

      <View style={{ gap: 8 }}>
        <Question>How often are you paid?</Question>
        <Segmented
          options={[
            { key: 'monthly', label: 'Monthly' },
            { key: 'fortnightly', label: 'Every 2 weeks' },
            { key: 'weekly', label: 'Weekly' },
          ]}
          value={freq}
          onChange={setFreq}
        />
      </View>

      {freq === 'monthly' ? (
        <View style={{ gap: 8 }}>
          <Question>When does your main pay land?</Question>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="On the 1st" selected={!other && payday === 1} onPress={() => { setOther(false); setPayday(1); }} />
            <Chip
              label={other ? `On the ${ordinal(payday)}` : 'Another date'}
              selected={other}
              onPress={() => { setOther(true); if (payday === 1 || payday >= 31) setPayday(7); }}
            />
            <Chip label="Last day of the month" selected={!other && payday >= 31} onPress={() => { setOther(false); setPayday(31); }} />
          </View>
          {other ? (
            <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12 }}>
              <DueDayInput label="Payday" value={payday} onChange={setPayday} />
            </View>
          ) : null}
          <T v="small" color={C.inkMuted}>
            So your budget runs from one payday to the next, not by calendar month. If it moves for a holiday, you can change it later.
          </T>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Question>When was your last payday (or when is the next one)?</Question>
          <DateField
            label="A payday"
            value={profile.payAnchor ?? today}
            onChange={(iso) => actions.updateProfile({ payAnchor: iso })}
            minimumDate={addDays(today, -60)}
            maximumDate={addDays(today, 60)}
          />
          <T v="small" color={C.inkMuted}>
            {`Your budget runs ${freq === 'weekly' ? 'week to week' : 'in two-week cycles'}, from one payday to the next. Next payday: ${prettyDate(nextPayday({ ...profile, payFrequency: freq, payAnchor: profile.payAnchor ?? today }))}. You'll still enter income as a monthly amount on the next screen.`}
          </T>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Question>Which days do you usually work?</Question>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Mon – Fri" selected={daysMode === 'fri'} onPress={() => actions.updateProfile({ workDays: MON_FRI })} />
          <Chip label="Mon – Sat" selected={daysMode === 'sat'} onPress={() => actions.updateProfile({ workDays: MON_SAT })} />
        </View>
        <WeekdayToggles value={profile.workDays} onChange={(v) => actions.updateProfile({ workDays: v })} />
        <T v="small" color={C.inkMuted} style={{ fontFamily: F.body }}>
          {daysMode === 'custom'
            ? `Working ${describeWorkDays(profile.workDays)}. Shifts change? Pick your usual pattern; you can change it any time.`
            : 'Days off usually cost a bit more, so I give them a bigger share. Tap a day to change it.'}
        </T>
      </View>
    </ObScaffold>
  );
}
