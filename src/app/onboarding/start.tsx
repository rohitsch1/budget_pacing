import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { dayPlan, prettyDate, todayISO } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { type Debt, updateDraft, useDraft } from '@/features/onboarding/draft';
import { AddChip, AmountInput, Bubble, LinkButton, ObScaffold, Reply, Segmented, SkipLink, TextField, useObFlow } from '@/features/onboarding/kit';
import { stillDueThisCycle } from '@/features/onboarding/logic';
import { actions, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

export default function Start() {
  const profile = useStore((s) => s.profile);
  const draft = useDraft();
  const flow = useObFlow('/onboarding/building');
  const cur = profile.currency;
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState('');
  const [amt, setAmt] = useState<number | null>(null);
  const [dir, setDir] = useState<Debt['dir']>('owe');

  const today = todayISO();
  const plan = dayPlan({ ...profile, start: null }, [], today);
  const midCycle = today > plan.cycle.start;
  const due = stillDueThisCycle(profile, today);
  const owe = draft.debts.filter((d) => d.dir === 'owe').reduce((a, d) => a + d.amount, 0);
  const haveCash = draft.bank != null || draft.cash != null;
  const suggestion = Math.max(0, (draft.bank ?? 0) + (draft.cash ?? 0) - due - owe);
  const left = profile.start?.flexibleLeft ?? null;

  const setLeft = (v: number | null) => actions.updateProfile({ start: v == null ? null : { date: today, flexibleLeft: v } });
  const addDebt = () => {
    if (!amt) return;
    updateDraft({ debts: [...draft.debts, { id: newId('debt'), who: who.trim() || 'Someone', amount: amt, dir }] });
    setAdding(false);
    setWho('');
    setAmt(null);
  };

  const field = (label: string, value: number | null, key: 'bank' | 'cash' | 'savedSoFar') => (
    <View style={{ flex: 1, gap: 6 }}>
      <T v="bodySemi" style={{ fontSize: 14 }}>
        {label}
      </T>
      <AmountInput label={label} value={value} onChange={(v) => updateDraft({ [key]: v })} currency={cur} />
    </View>
  );

  return (
    <ObScaffold
      chapter="YOUR CUSHION"
      right={flow.isEdit ? null : <SkipLink label="Skip" onPress={flow.skip} />}
      footer={<Button label={flow.label('Build my plan')} onPress={flow.go} />}>
      <Bubble>Last question, all optional. Where do you stand right now? It helps me check the plan is realistic, especially when payday is far away.</Bubble>

      {field('In your bank account', draft.bank, 'bank')}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {field('Cash in hand', draft.cash, 'cash')}
        {field('Savings so far', draft.savedSoFar, 'savedSoFar')}
      </View>

      <View style={{ gap: 8 }}>
        <T v="bodySemi" style={{ fontSize: 14 }}>
          Anything you owe or are owed?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {draft.debts.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityHint="Removes this"
              onPress={() => updateDraft({ debts: draft.debts.filter((x) => x.id !== d.id) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: d.dir === 'owe' ? C.coralSoft : C.okSoft }}>
              <T v="small" color={d.dir === 'owe' ? C.coralInk : C.ok} style={{ fontFamily: F.bodySemi }}>
                {d.dir === 'owe' ? `I owe ${d.who} ${fmt(d.amount, cur)}` : `${d.who} owes me ${fmt(d.amount, cur)}`}
              </T>
              <T v="small" color={d.dir === 'owe' ? C.coralInk : C.ok}>
                ✕
              </T>
            </Pressable>
          ))}
          {!adding ? <AddChip label="Add" onPress={() => setAdding(true)} /> : null}
        </View>
        {adding ? (
          <View style={{ gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 }}>
            <Segmented
              options={[
                { key: 'owe', label: 'I owe' },
                { key: 'owed', label: 'Owed to me' },
              ]}
              value={dir}
              onChange={setDir}
            />
            <TextField label="Who" value={who} onChange={setWho} placeholder="Name" />
            <AmountInput label="Amount" value={amt} onChange={setAmt} currency={cur} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small kind="secondary" label="Cancel" onPress={() => setAdding(false)} style={{ flex: 1 }} />
              <Button small label="Add" disabled={!amt} onPress={addDebt} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </View>

      {midCycle ? (
        <View style={{ backgroundColor: C.white, borderWidth: 1.5, borderColor: C.harbor, borderRadius: 18, padding: 16, gap: 8 }}>
          <T v="bodySemi">Left for day-to-day until payday</T>
          <T v="small" color={C.inkMuted}>
            {`You're joining part-way through this pay cycle (it ends ${prettyDate(plan.cycle.end)}). If you've already spent some of this month's money, tell me what's really left and I'll start from there.`}
          </T>
          <AmountInput label="Left for day-to-day until payday" value={left} onChange={setLeft} currency={cur} placeholder={fmt(plan.remaining, cur).replace(/^\D+/, '')} />
          {haveCash && suggestion !== left ? (
            <LinkButton
              label={`Use ${fmt(suggestion, cur)} (bank + cash − ${fmt(due + owe, cur)} still due)`}
              onPress={() => setLeft(suggestion)}
            />
          ) : null}
          {left != null ? <LinkButton label="Use my full plan instead" onPress={() => setLeft(null)} /> : null}
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      {haveCash || left != null ? (
        <Reply k="thanks">Thanks. I&apos;ll use this to check the plan against real cash, and warn you early if money could run short before payday.</Reply>
      ) : null}
    </ObScaffold>
  );
}
