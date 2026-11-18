import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Chip, T } from '@/components/ui';
import { emiMonthsLeft } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Emi } from '@/domain/types';
import { type CardBalance, updateDraft, useDraft } from '@/features/onboarding/draft';
import { AddChip, Bubble, ItemEditor, ObScaffold, Reply, Segmented, SkipLink, useObFlow } from '@/features/onboarding/kit';
import { emiEndDate, emiEndsLabel, onThe, sumAmounts } from '@/features/onboarding/logic';
import { actions, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const KINDS = ['Home loan', 'Car loan', 'Bike loan', 'Personal loan', 'Education loan', 'Card EMI', 'Other loan'];
const CARD: { k: CardBalance; l: string }[] = [
  { k: 'full', l: 'I pay it in full' },
  { k: 'sometimes', l: 'Sometimes' },
  { k: 'none', l: 'No card' },
];

export default function Emis() {
  const profile = useStore((s) => s.profile);
  const draft = useDraft();
  const flow = useObFlow('/onboarding/routine');
  const [has, setHas] = useState<'yes' | 'no'>(profile.emis.length ? 'yes' : 'no');
  const [open, setOpen] = useState<string | null>(null);
  const cur = profile.currency;
  const emis = profile.emis;

  const save = (next: Emi[]) => actions.updateProfile({ emis: next });
  const patch = (id: string, p: Partial<Emi>) => save(emis.map((e) => (e.id === id ? { ...e, ...p } : e)));
  /** Months left → also store the last instalment date so the EMI stops counting once paid off. */
  const setMonthsLeft = (e: Emi, n: number | null) =>
    patch(e.id, { monthsLeft: n, endDate: n ? emiEndDate(e.dueDay, n) : null });
  const setDueDay = (e: Emi, d: number) => {
    const left = emiMonthsLeft(e);
    patch(e.id, { dueDay: d, endDate: left ? emiEndDate(d, left) : e.endDate ?? null });
  };
  const add = (name: string) => {
    const e: Emi = { id: newId('emi'), name: name === 'Other loan' ? '' : name, amount: 0, dueDay: 5, monthsLeft: null };
    save([...emis, e]);
    setHas('yes');
    setOpen(e.id);
  };

  const total = sumAmounts(emis.filter((e) => emiMonthsLeft(e) !== 0));
  const ending = emis
    .map((e) => ({ e, left: emiMonthsLeft(e) }))
    .filter((x) => x.left != null && x.left > 0 && x.left <= 18 && x.e.amount > 0)
    .sort((a, b) => (a.left ?? 0) - (b.left ?? 0))[0];

  return (
    <ObScaffold
      chapter="MONEY OUT"
      right={flow.isEdit ? null : <SkipLink onPress={flow.skip} />}
      footer={
        <Button
          label={flow.label('Continue')}
          onPress={() => {
            if (has === 'no') save([]);
            else save(emis.filter((e) => e.amount > 0));
            flow.go();
          }}
        />
      }>
      <Bubble>Do you repay any loans? EMIs come first, so I&apos;ll keep them completely out of your spending money. No judgement here, most people have one.</Bubble>

      <Segmented
        options={[
          { key: 'yes', label: 'Yes, I have EMIs' },
          { key: 'no', label: 'No loans' },
        ]}
        value={has}
        onChange={(k) => {
          setHas(k);
          if (k === 'yes' && emis.length === 0) add('Personal loan');
        }}
      />

      {has === 'yes' ? (
        <View style={{ gap: 10 }}>
          {emis.map((e) => (
            <View key={e.id} style={{ backgroundColor: C.white, borderWidth: 1, borderColor: open === e.id ? C.harbor : C.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 }}>
              {open === e.id ? (
                <ItemEditor
                  name={e.name}
                  amount={e.amount}
                  dueDay={e.dueDay}
                  currency={cur}
                  onName={(v) => patch(e.id, { name: v })}
                  onAmount={(v) => patch(e.id, { amount: v })}
                  onDueDay={(v) => setDueDay(e, v)}
                  onRemove={() => { save(emis.filter((x) => x.id !== e.id)); setOpen(null); }}
                  onDone={() => setOpen(null)}
                  extra={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <T v="caption" color={C.inkMuted} style={{ flex: 1 }}>
                        Months left (optional)
                      </T>
                      <TextInput
                        accessibilityLabel="Months left"
                        value={emiMonthsLeft(e) == null ? '' : String(emiMonthsLeft(e))}
                        onChangeText={(t) => {
                          const n = t.replace(/[^0-9]/g, '');
                          setMonthsLeft(e, n && Number(n) > 0 ? Math.min(600, Number(n)) : null);
                        }}
                        keyboardType="number-pad"
                        placeholder="e.g. 24"
                        placeholderTextColor={C.inkDisabled}
                        style={{ width: 90, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.display, fontSize: 15, color: C.ink, backgroundColor: C.white }}
                      />
                    </View>
                  }
                />
              ) : (
                <Pressable accessibilityRole="button" accessibilityHint="Edit loan" onPress={() => setOpen(e.id)} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <T v="bodySemi">{e.name || 'Loan'}</T>
                    <T style={{ fontFamily: F.display, fontSize: 18 }}>{fmt(e.amount, cur)}</T>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T v="caption" color={C.inkMuted}>
                      {onThe(e.dueDay) + (emiMonthsLeft(e) === 0 ? ' · paid off' : emiMonthsLeft(e) ? ` · ${emiMonthsLeft(e)} months left` : '')}
                    </T>
                    {emiEndsLabel(e) ? (
                      <T v="caption" color={C.inkMuted}>
                        {emiEndsLabel(e)}
                      </T>
                    ) : null}
                  </View>
                </Pressable>
              )}
            </View>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {KINDS.map((k) => (
              <AddChip key={k} label={k} onPress={() => add(k)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <T v="bodySemi">Do you carry a credit card balance?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CARD.map((c) => (
            <Chip key={c.k} label={c.l} selected={draft.cardBalance === c.k} onPress={() => updateDraft({ cardBalance: c.k })} />
          ))}
        </View>
        {draft.cardBalance === 'sometimes' ? (
          <T v="small" color={C.inkMuted}>
            Tip: add what you usually pay towards the card as a “Card EMI” above, so it&apos;s set aside like any other loan.
          </T>
        ) : null}
      </View>

      <View style={{ flex: 1 }} />
      {has === 'yes' && total > 0 ? (
        <Reply k={`${total}-${ending?.e.id ?? ''}`}>
          <T v="small" color={C.onDark} style={{ fontSize: 14, lineHeight: 21 }}>
            {`${fmt(total, cur)} a month in EMIs.`}
            {ending ? (
              <>
                {` Good news: the ${ending.e.name.toLowerCase() || 'loan'} ends in ${ending.left} ${ending.left === 1 ? 'month' : 'months'}, freeing up `}
                <T v="small" color={C.mint} style={{ fontFamily: F.bodyBold, fontSize: 14 }}>
                  {`${fmt(ending.e.amount, cur)} a month`}
                </T>
                .
              </>
            ) : (
              ' I’ll set this aside before anything else.'
            )}
          </T>
        </Reply>
      ) : has === 'no' ? (
        <Reply k="none">No loans. That gives your daily number a lot more room.</Reply>
      ) : null}
    </ObScaffold>
  );
}
