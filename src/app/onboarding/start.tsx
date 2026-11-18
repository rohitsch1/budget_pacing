import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { dayPlan, prettyDate, todayISO } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Debt } from '@/domain/types';
import { getDraft, updateDraft, useDraft } from '@/features/onboarding/draft';
import { AddChip, AmountInput, Bubble, LinkButton, ObScaffold, Reply, Segmented, SkipLink, TextField, useObFlow } from '@/features/onboarding/kit';
import { stillDueThisCycle } from '@/features/onboarding/logic';
import { actions, getState, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

export default function Start() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const draft = useDraft();
  const flow = useObFlow('/onboarding/building');
  const cur = profile.currency;
  const debts = profile.debts ?? [];
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState('');
  const [amt, setAmt] = useState<number | null>(null);
  const [dir, setDir] = useState<Debt['dir']>('owe');
  // What the user typed for "left until payday". Only saved into profile.start on Save / Build.
  const [left, setLeftRaw] = useState<number | null>(() => {
    const s = getState().profile.start;
    return s && !s.auto ? s.flexibleLeft : null;
  });
  const [cleared, setCleared] = useState(false);
  const [touched, setTouched] = useState(false);
  const setLeft = (v: number | null) => {
    setLeftRaw(v);
    setTouched(true);
  };

  // One-time move of debts entered by older versions (kept in the onboarding draft) into the profile.
  useEffect(() => {
    const d = getDraft();
    if (d.debts.length && !(getState().profile.debts ?? []).length) {
      actions.updateProfile({ debts: d.debts.map((x) => ({ id: x.id, label: x.who, amount: x.amount, dir: x.dir })) });
      updateDraft({ debts: [] });
    }
  }, []);

  const today = todayISO();
  const fresh = dayPlan({ ...profile, start: null }, [], today);
  const current = dayPlan(profile, entries, today);
  const midCycle = today > fresh.cycle.start;
  const showLeft = midCycle || flow.isEdit;
  const due = stillDueThisCycle(profile, today);
  const owe = debts.filter((d) => d.dir === 'owe').reduce((a, d) => a + d.amount, 0);
  const haveCash = draft.bank != null || draft.cash != null;
  const suggestion = Math.max(0, (draft.bank ?? 0) + (draft.cash ?? 0) - due - owe);
  const placeholder = flow.isEdit ? current.remaining : fresh.remaining;

  const addDebt = () => {
    if (!amt) return;
    actions.updateProfile({ debts: [...debts, { id: newId('debt'), label: who.trim() || 'Someone', amount: amt, dir }] });
    setAdding(false);
    setWho('');
    setAmt(null);
  };

  const save = () => {
    if (touched && left != null) actions.updateProfile({ start: { date: today, flexibleLeft: left, auto: false } });
    else if (cleared || (touched && left == null)) actions.updateProfile({ start: null });
    flow.go();
  };

  const useFullPlan = () => {
    setLeft(null);
    setCleared(true);
  };

  const field = (label: string, value: number | null, onChange: (v: number | null) => void) => (
    <View style={{ flex: 1, gap: 6 }}>
      <T v="bodySemi" style={{ fontSize: 14 }}>
        {label}
      </T>
      <AmountInput label={label} value={value} onChange={onChange} currency={cur} />
    </View>
  );

  const hasManualStart = left != null || (!cleared && !!profile.start && !profile.start.auto);

  return (
    <ObScaffold
      chapter="YOUR CUSHION"
      right={flow.isEdit ? null : <SkipLink label="Skip" onPress={flow.skip} />}
      footer={<Button label={flow.label('Build my plan')} onPress={save} />}>
      <Bubble>Last question, all optional. Where do you stand right now? It helps me check the plan is realistic, especially when payday is far away.</Bubble>

      {field('In your bank account', draft.bank, (v) => updateDraft({ bank: v }))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {field('Cash in hand', draft.cash, (v) => updateDraft({ cash: v }))}
        {field('Savings so far', profile.savedSoFar || null, (v) => actions.updateProfile({ savedSoFar: v ?? 0 }))}
      </View>

      <View style={{ gap: 8 }}>
        <T v="bodySemi" style={{ fontSize: 14 }}>
          Anything you owe or are owed?
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {debts.map((d) => (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityHint="Removes this"
              onPress={() => actions.updateProfile({ debts: debts.filter((x) => x.id !== d.id) })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: d.dir === 'owe' ? C.coralSoft : C.okSoft }}>
              <T v="small" color={d.dir === 'owe' ? C.coralInk : C.ok} style={{ fontFamily: F.bodySemi }}>
                {d.dir === 'owe' ? `I owe ${d.label} ${fmt(d.amount, cur)}` : `${d.label} owes me ${fmt(d.amount, cur)}`}
              </T>
              <T v="small" color={d.dir === 'owe' ? C.coralInk : C.ok}>
                ✕
              </T>
            </Pressable>
          ))}
          {!adding ? <AddChip label="Add" onPress={() => setAdding(true)} /> : null}
        </View>
        {debts.length ? (
          <T v="caption" color={C.inkMuted}>
            You&apos;ll find these on the Plan tab under Money owed, where you can mark them settled.
          </T>
        ) : null}
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

      {showLeft ? (
        <View style={{ backgroundColor: C.white, borderWidth: 1.5, borderColor: C.harbor, borderRadius: 18, padding: 16, gap: 8 }}>
          <T v="bodySemi">Left for day-to-day until payday</T>
          <T v="small" color={C.inkMuted}>
            {flow.isEdit
              ? `Your cycle ends ${prettyDate(fresh.cycle.end)}. If your real balance differs from Pace, type what's really left for day-to-day spending and I'll start from today with that.`
              : `You're joining part-way through this pay cycle (it ends ${prettyDate(fresh.cycle.end)}). If you've already spent some of this month's money, tell me what's really left and I'll start from there.`}
          </T>
          <AmountInput label="Left for day-to-day until payday" value={left} onChange={setLeft} currency={cur} placeholder={fmt(Math.max(0, placeholder), cur).replace(/^\D+/, '')} />
          {haveCash && suggestion !== left ? (
            <LinkButton
              label={`Use ${fmt(suggestion, cur)} (bank + cash − ${fmt(due + owe, cur)} still due)`}
              onPress={() => {
                setLeft(suggestion);
                setCleared(false);
              }}
            />
          ) : null}
          {hasManualStart ? <LinkButton label="Use my full plan instead" onPress={useFullPlan} /> : null}
          {flow.isEdit ? (
            <T v="caption" color={C.inkMuted}>
              {profile.start && !cleared
                ? profile.start.auto
                  ? `Now: your share of the plan since you joined on ${prettyDate(profile.start.date)}.`
                  : `Now: ${fmt(profile.start.flexibleLeft, cur)} left as of ${prettyDate(profile.start.date)}.`
                : 'Now: your full plan for this cycle.'}
            </T>
          ) : null}
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      {haveCash || left != null ? (
        <Reply k="thanks">Thanks. I&apos;ll use this to check the plan against real cash, and warn you early if money could run short before payday.</Reply>
      ) : null}
    </ObScaffold>
  );
}
