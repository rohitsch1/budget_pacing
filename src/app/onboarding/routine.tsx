import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { AddChip, Bubble, ItemEditor, ListCard, ObScaffold, Reply, SkipLink, useObFlow } from '@/features/onboarding/kit';
import { sumAmounts, typical } from '@/features/onboarding/logic';
import { actions, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

type Item = { id: string; name: string; amount: number };

const SUGGEST: { name: string; note: string; inr: number }[] = [
  { name: 'Groceries', note: 'Monthly stock-up + top-ups', inr: 6000 },
  { name: 'Gym membership', note: 'Fitness, sports club', inr: 2000 },
  { name: 'House help', note: 'Cleaning, cooking', inr: 2500 },
  { name: 'Sending home', note: 'Family support', inr: 1500 },
  { name: 'Fuel', note: 'Car, bike', inr: 2000 },
  { name: 'Medicines', note: 'Regular prescriptions', inr: 800 },
  { name: 'Pet care', note: 'Food, vet', inr: 1500 },
  { name: "Kids' classes", note: 'Tuition, hobbies', inr: 2000 },
];

export default function Routine() {
  const profile = useStore((s) => s.profile);
  const flow = useObFlow('/onboarding/week');
  const [open, setOpen] = useState<string | null>(null);
  const cur = profile.currency;
  const items = profile.routineItems;

  const save = (next: Item[]) => actions.updateProfile({ routineItems: next, routineMonthly: sumAmounts(next) });
  const add = (name: string, amount: number) => {
    const it: Item = { id: newId('rt'), name, amount };
    save([...items, it]);
    if (!name || !amount) setOpen(it.id);
  };
  const total = sumAmounts(items);

  return (
    <ObScaffold
      chapter="MONEY OUT"
      right={flow.isEdit ? null : <SkipLink onPress={flow.skip} />}
      footer={<Button label={flow.isEdit ? 'Save' : total > 0 ? `Continue · ${fmt(total, cur)} a month` : 'Continue'} onPress={() => { save(items.filter((i) => i.amount > 0)); flow.go(); }} />}>
      <Bubble>Some spending isn&apos;t a bill, but happens every month anyway: gym, the big grocery run, help at home. Let&apos;s put these aside too, so they don&apos;t eat into your daily number.</Bubble>

      {items.length ? (
        <ListCard>
          {items.map((it, i) => (
            <View key={it.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }}>
              {open === it.id ? (
                <ItemEditor
                  name={it.name}
                  amount={it.amount}
                  currency={cur}
                  onName={(v) => save(items.map((x) => (x.id === it.id ? { ...x, name: v } : x)))}
                  onAmount={(v) => save(items.map((x) => (x.id === it.id ? { ...x, amount: v } : x)))}
                  onRemove={() => { save(items.filter((x) => x.id !== it.id)); setOpen(null); }}
                  onDone={() => setOpen(null)}
                />
              ) : (
                <Pressable accessibilityRole="button" accessibilityHint="Edit" onPress={() => setOpen(it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 }}>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T v="bodySemi" style={{ fontSize: 14 }}>
                      {it.name || 'Something regular'}
                    </T>
                    <T v="caption" color={C.inkMuted}>
                      {SUGGEST.find((s) => s.name === it.name)?.note ?? 'Every month'}
                    </T>
                  </View>
                  <T style={{ fontFamily: F.display, fontSize: 15 }}>{fmt(it.amount, cur)}</T>
                </Pressable>
              )}
            </View>
          ))}
        </ListCard>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {SUGGEST.filter((s) => !items.some((i) => i.name === s.name)).map((s) => (
          <AddChip key={s.name} label={s.name} onPress={() => add(s.name, typical(s.inr, profile.region))} />
        ))}
        <AddChip label="Something else" onPress={() => add('', 0)} />
      </View>
      {items.length ? (
        <T v="caption" color={C.inkMuted}>
          Tap any line to change the amount. Rough is fine.
        </T>
      ) : null}

      <View style={{ flex: 1 }} />
      {total > 0 ? (
        <Reply k={String(items.length)}>{`${fmt(total, cur)} a month, set aside on payday. Your daily number only covers the day-to-day.`}</Reply>
      ) : null}
    </ObScaffold>
  );
}
