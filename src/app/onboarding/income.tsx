import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import type { Recurring } from '@/domain/types';
import { AddChip, AmountInput, Bubble, ItemEditor, ListCard, ObScaffold, Reply, Toggle, useObFlow } from '@/features/onboarding/kit';
import { onThe, ordinal, sumAmounts } from '@/features/onboarding/logic';
import { actions, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const SALARY_ID = 'inc_salary';
const SUGGEST = ['Freelance', 'Business', 'Interest / dividends', 'Family support', 'Rent received', 'Other'];

export default function Income() {
  const profile = useStore((s) => s.profile);
  const flow = useObFlow('/onboarding/milestone');
  const [open, setOpen] = useState<string | null>(null);
  const cur = profile.currency;

  const salary = profile.incomes.find((x) => x.id === SALARY_ID);
  const others = profile.incomes.filter((x) => x.id !== SALARY_ID);
  const total = sumAmounts(profile.incomes);

  const setSalary = (amount: number | null) => {
    const s: Recurring = { id: SALARY_ID, name: 'Salary', amount: amount ?? 0, dueDay: profile.payday };
    actions.updateProfile({ incomes: [s, ...others] });
  };
  const patch = (id: string, p: Partial<Recurring>) =>
    actions.updateProfile({ incomes: profile.incomes.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const remove = (id: string) => {
    actions.updateProfile({ incomes: profile.incomes.filter((x) => x.id !== id) });
    setOpen(null);
  };
  const add = (name: string) => {
    const item: Recurring = { id: newId('inc'), name: name === 'Other' ? '' : name, amount: 0, dueDay: profile.payday };
    actions.updateProfile({ incomes: [...profile.incomes, item] });
    setOpen(item.id);
  };

  return (
    <ObScaffold
      chapter="MONEY IN"
      footer={
        <>
          <View style={{ backgroundColor: C.harbor, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="small" color={C.onDarkMuted}>
              {total > 0 ? `About ${fmt(total, cur)} a month` : 'Your monthly take-home'}
            </T>
            <T color={C.mint} style={{ fontFamily: F.display, fontSize: 24 }}>
              {fmt(total, cur)}
            </T>
          </View>
          <Button label={flow.label('Continue')} disabled={total <= 0} onPress={flow.go} />
        </>
      }>
      <Bubble>How much reaches your account each month? Use take-home pay, after tax and deductions, the amount you actually see.</Bubble>

      <View style={{ backgroundColor: C.white, borderWidth: 1.5, borderColor: C.harbor, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <T v="bodySemi">Salary</T>
          <T v="caption" color={C.inkMuted}>
            {`Monthly · on the ${ordinal(Math.min(profile.payday, 31))} · ${profile.irregularIncome ? 'varies' : 'fixed'}`}
          </T>
        </View>
        <AmountInput size="lg" label="Salary amount" value={salary?.amount || null} onChange={setSalary} currency={cur} />
        <T v="caption" color={C.inkMuted}>
          Not sure? Check your last salary credit message.
        </T>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <T v="bodySemi" style={{ fontSize: 14 }}>
            My income changes month to month
          </T>
          <T v="caption" color={C.inkMuted}>
            I&apos;ll plan on a lower, typical month
          </T>
        </View>
        <Toggle label="Income changes month to month" on={profile.irregularIncome} onChange={(v) => actions.updateProfile({ irregularIncome: v })} />
      </View>
      {profile.irregularIncome ? (
        <Reply k="irr">Good call. Enter what comes in during a slower month. Anything above that is a bonus, not a reason to spend more.</Reply>
      ) : null}

      <Bubble delay={300}>Anything else coming in? Tap what applies.</Bubble>

      {others.length ? (
        <ListCard>
          {others.map((x, i) => (
            <View key={x.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }}>
              {open === x.id ? (
                <ItemEditor
                  name={x.name}
                  amount={x.amount}
                  dueDay={x.dueDay}
                  currency={cur}
                  dueLabel="Arrives"
                  onName={(v) => patch(x.id, { name: v })}
                  onAmount={(v) => patch(x.id, { amount: v })}
                  onDueDay={(v) => patch(x.id, { dueDay: v })}
                  onRemove={() => remove(x.id)}
                  onDone={() => setOpen(null)}
                />
              ) : (
                <Pressable accessibilityRole="button" accessibilityHint="Edit" onPress={() => setOpen(x.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingVertical: 8 }}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T v="bodySemi" style={{ fontSize: 14 }}>
                      {x.name || 'Other income'}
                    </T>
                    <T v="caption" color={C.inkMuted}>
                      {`Monthly · ${onThe(x.dueDay).toLowerCase()}`}
                    </T>
                  </View>
                  <T style={{ fontFamily: F.display, fontSize: 17 }}>{fmt(x.amount, cur)}</T>
                </Pressable>
              )}
            </View>
          ))}
        </ListCard>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {SUGGEST.filter((n) => n === 'Other' || !others.some((o) => o.name === n)).map((n) => (
          <AddChip key={n} label={n} onPress={() => add(n)} />
        ))}
      </View>
    </ObScaffold>
  );
}
