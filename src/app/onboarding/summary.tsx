import { type Href, router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button, Icon, T } from '@/components/ui';
import { dayPlan, withJoinStart, planTotals } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { useDraft } from '@/features/onboarding/draft';
import { ObScaffold } from '@/features/onboarding/kit';
import { defaultUsual, sumAmounts } from '@/features/onboarding/logic';
import { useStore } from '@/store';
import { C, F } from '@/theme/tokens';

function edit(path: string) {
  router.push({ pathname: path, params: { edit: '1' } } as Href);
}

const list = (xs: string[], fallback: string) => (xs.length ? xs.slice(0, 4).join(', ') + (xs.length > 4 ? '…' : '') : fallback);

export default function Summary() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const draft = useDraft();
  const cur = profile.currency;
  const t = planTotals(profile);
  const plan = dayPlan(withJoinStart(profile), entries);
  const first = profile.name.trim().split(/\s+/)[0];

  const rent = profile.bills.filter((b) => b.name === 'Rent');
  const otherBills = profile.bills.filter((b) => b.name !== 'Rent');
  const rentAmt = sumAmounts(rent);
  const billsAmt = sumAmounts(otherBills);

  const rows = [
    { n: 'Income', s: list(profile.incomes.map((i) => i.name || 'Other'), 'Add what comes in'), a: fmt(t.income, cur), v: 0, c: C.harbor, to: '/onboarding/income' },
    { n: 'EMIs', s: list(profile.emis.map((e) => `${e.name || 'Loan'} ${fmt(e.amount, cur)}`), 'No loans'), a: fmt(-t.emis, cur), v: t.emis, c: C.inkMuted, to: '/onboarding/emi' },
    ...(rentAmt ? [{ n: 'Rent', s: `Due on the ${rent[0].dueDay}`, a: fmt(-rentAmt, cur), v: rentAmt, c: C.inkFaint, to: '/onboarding/bills' }] : []),
    { n: rentAmt ? 'Bills' : 'Rent & bills', s: list(otherBills.map((b) => b.name), 'None added'), a: fmt(-billsAmt, cur), v: billsAmt, c: '#8FA0A3', to: '/onboarding/bills' },
    { n: 'Routine', s: list(profile.routineItems.map((r) => r.name), 'None added'), a: fmt(-t.routine, cur), v: t.routine, c: '#BCC8C9', to: '/onboarding/routine' },
    { n: 'Savings', s: t.savings ? 'Moved out on payday' : 'Not yet', a: fmt(-t.savings, cur), v: t.savings, c: C.link, to: '/onboarding/savings' },
  ];
  const segs = [...rows.slice(1).map((r) => ({ v: r.v, c: r.c })), { v: Math.max(0, t.flexible), c: C.mint }].filter((x) => x.v > 0);

  const usualWork = draft.usualWorkDay ?? defaultUsual(profile.region).work;
  const usualOff = draft.usualDayOff ?? Math.round(usualWork * profile.weekendWeight);
  const usualCost = plan.workDaysLeft * usualWork + plan.weekendDaysLeft * usualOff + plan.extrasReserved;
  const room = plan.remaining - usualCost;
  const extrasNames = [...new Set(profile.dayExtras.map((x) => x.label))];
  const usualPhrase = `Your usual days${extrasNames.length ? ` plus ${extrasNames.join(', ')}` : ''}`;

  return (
    <ObScaffold
      gap={16}
      right={null}
      chapter={first ? `YOUR PLAN, ${first.toUpperCase()}` : 'YOUR PLAN'}
      footer={<Button label="Looks right, start" disabled={t.income <= 0} onPress={() => router.push('/onboarding/reminders')} />}>
      <View style={{ gap: 4 }}>
        <T v="small" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
          {`Here's where ${fmt(t.income, cur)} goes`}
        </T>
        <View accessibilityRole="image" accessibilityLabel="Split of monthly income" style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginTop: 6 }}>
          {segs.length ? segs.map((x, i) => <View key={i} style={{ flex: x.v, backgroundColor: x.c }} />) : <View style={{ flex: 1, backgroundColor: C.line }} />}
        </View>
      </View>

      <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 }}>
        {rows.map((r, i) => (
          <View key={r.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: r.c }} />
            <View style={{ flex: 1, paddingVertical: 6, gap: 1 }}>
              <T v="body" style={{ fontFamily: F.bodyMed }}>
                {r.n}
              </T>
              <T v="caption" color={C.inkMuted} numberOfLines={1}>
                {r.s}
              </T>
            </View>
            <T style={{ fontFamily: F.display, fontSize: 16 }}>{r.a}</T>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${r.n}`} hitSlop={4} onPress={() => edit(r.to)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="edit" size={16} color={C.inkMuted} />
            </Pressable>
          </View>
        ))}
      </View>

      {t.flexible > 0 ? (
        <View style={{ backgroundColor: C.harbor, borderRadius: 24, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <T v="label" color={C.onDarkMuted} style={{ letterSpacing: 0.6, flexShrink: 1 }}>
              FREE TO SPEND DAY TO DAY
            </T>
            <T color={C.mint} style={{ fontFamily: F.display, fontSize: 28 }}>
              {fmt(t.flexible, cur)}
            </T>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              ['Work day', plan.perWorkDay],
              ['Day off', plan.perWeekendDay],
            ].map(([l, v]) => (
              <View key={l} style={{ flex: 1, backgroundColor: C.harborMid, borderRadius: 14, padding: 12, gap: 2 }}>
                <T v="caption" color={C.onDarkMuted}>
                  {l}
                </T>
                <T color={C.onDark} style={{ fontFamily: F.display, fontSize: 20 }}>
                  {fmt(v as number, cur)}
                </T>
              </View>
            ))}
          </View>
          <T v="caption" color={C.onDarkMuted} style={{ lineHeight: 18 }}>
            {room >= 0
              ? `${usualPhrase} cost ${fmt(usualCost, cur)} until payday, so you have ${fmt(room, cur)} of breathing room this cycle.`
              : `${usualPhrase} cost ${fmt(usualCost, cur)} until payday, about ${fmt(-room, cur)} more than you have. Small trims add up, and I'll show you where.`}
          </T>
        </View>
      ) : (
        <View style={{ backgroundColor: C.coralSoft, borderRadius: 20, padding: 16, gap: 6 }}>
          <T v="bodySemi" color={C.coralInk}>
            {`Your plan is ${fmt(-t.flexible, cur)} over each month`}
          </T>
          <T v="small" color={C.ink}>
            Bills, EMIs, routine and savings add up to more than comes in. Try lowering savings or routine for now. Tap the pencil next to any line.
          </T>
        </View>
      )}
    </ObScaffold>
  );
}
