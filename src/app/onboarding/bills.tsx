import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import type { Recurring } from '@/domain/types';
import { AddChip, Bubble, Check, ItemEditor, ListCard, ObScaffold, Reply, SkipLink, useObFlow } from '@/features/onboarding/kit';
import { onThe, sumAmounts, typical } from '@/features/onboarding/logic';
import { actions, getState, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

interface Row extends Recurring {
  on: boolean;
  note?: string;
  preset?: boolean;
}

const PRESETS: { name: string; note: string; inr: number; due: number; on: boolean }[] = [
  { name: 'Rent', note: 'must pay', inr: 10000, due: 3, on: true },
  { name: 'Electricity', note: 'varies', inr: 1400, due: 18, on: true },
  { name: 'Internet', note: '', inr: 799, due: 20, on: true },
  { name: 'Mobile', note: '', inr: 399, due: 22, on: true },
  { name: 'Streaming', note: 'subscriptions', inr: 402, due: 25, on: true },
  { name: 'Insurance', note: 'health, life, vehicle', inr: 1200, due: 10, on: false },
  { name: 'Course or school fees', note: 'monthly or yearly', inr: 2500, due: 5, on: false },
];

function initialRows(): Row[] {
  const p = getState().profile;
  const saved: Row[] = p.bills.map((b) => {
    const pre = PRESETS.find((x) => x.name === b.name);
    return { ...b, on: true, note: pre?.note, preset: !!pre };
  });
  const fresh = p.bills.length === 0;
  const missing: Row[] = PRESETS.filter((x) => !p.bills.some((b) => b.name === x.name)).map((x) => ({
    id: newId('bill'),
    name: x.name,
    amount: typical(x.inr, p.region),
    dueDay: x.due,
    on: fresh && x.on,
    note: x.note,
    preset: true,
  }));
  return [...saved, ...missing];
}

export default function Bills() {
  const cur = useStore((s) => s.profile.currency);
  const flow = useObFlow('/onboarding/emi');
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [open, setOpen] = useState<string | null>(null);

  const commit = (next: Row[]) => {
    setRows(next);
    actions.updateProfile({ bills: next.filter((r) => r.on).map(({ id, name, amount, dueDay }) => ({ id, name: name.trim() || 'Bill', amount, dueDay })) });
  };
  const patch = (id: string, p: Partial<Row>) => commit(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const add = () => {
    const r: Row = { id: newId('bill'), name: '', amount: 0, dueDay: 1, on: true };
    commit([...rows, r]);
    setOpen(r.id);
  };

  const total = sumAmounts(rows.filter((r) => r.on));

  return (
    <ObScaffold
      chapter="MONEY OUT"
      right={flow.isEdit ? null : <SkipLink onPress={flow.skip} />}
      footer={<Button label={flow.label('Continue')} onPress={() => { commit(rows); flow.go(); }} />}>
      <Bubble>Now the bills that come every month. Tap the ones you pay. I&apos;ve filled in typical amounts; adjust any that look off.</Bubble>

      <ListCard>
        {rows.map((r, i) => (
          <View key={r.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: r.on }}
                accessibilityLabel={r.name || 'Bill'}
                hitSlop={8}
                onPress={() => patch(r.id, { on: !r.on })}>
                <Check on={r.on} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Edit amount and due date"
                onPress={() => {
                  if (!r.on) patch(r.id, { on: true });
                  setOpen(open === r.id ? null : r.id);
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <View style={{ flex: 1, gap: 1 }}>
                  <T v="bodySemi" style={{ fontSize: 14 }}>
                    {r.name || 'New bill'}
                  </T>
                  <T v="caption" color={C.inkMuted}>
                    {onThe(r.dueDay) + (r.note ? ` · ${r.note}` : '')}
                  </T>
                </View>
                <T style={{ fontFamily: F.display, fontSize: 15, color: r.on ? C.ink : '#8FA0A3' }}>{fmt(r.amount, cur)}</T>
              </Pressable>
            </View>
            {open === r.id && r.on ? (
              <ItemEditor
                name={r.name}
                amount={r.amount}
                dueDay={r.dueDay}
                currency={cur}
                onName={r.preset ? undefined : (v) => patch(r.id, { name: v })}
                onAmount={(v) => patch(r.id, { amount: v })}
                onDueDay={(v) => patch(r.id, { dueDay: v })}
                onRemove={r.preset ? undefined : () => { commit(rows.filter((x) => x.id !== r.id)); setOpen(null); }}
                onDone={() => setOpen(null)}
              />
            ) : null}
          </View>
        ))}
      </ListCard>
      <View style={{ flexDirection: 'row' }}>
        <AddChip label="Add another bill" onPress={add} />
      </View>

      <View style={{ flex: 1 }} />
      <Reply k={String(total > 0)}>
        {total > 0
          ? `${fmt(total, cur)} a month. I'll lock this away on each due date so it never looks spendable.`
          : 'No regular bills? Lucky you. You can add them any time.'}
      </Reply>
    </ObScaffold>
  );
}
