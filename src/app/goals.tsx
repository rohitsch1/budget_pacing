import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Bar, Button, Card, Header, Icon, Screen, T } from '@/components/ui';
import { addDays, goalMonthly, prettyDate, todayISO } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { CurrencyCode, Goal } from '@/domain/types';
import { LinkText, ListCard } from '@/features/core/components';
import { AmountInput, TextField } from '@/features/onboarding/kit';
import { DateField } from '@/features/onboarding/time';
import { actions, getState, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const saveGoals = (goals: Goal[]) => actions.updateProfile({ goals });

/** Goals & planned purchases: Pace sets aside goalMonthly(g) every month until each target date. */
export default function Goals() {
  const goals = useStore((s) => s.profile.goals ?? []);
  const cur = useStore((s) => s.profile.currency);
  const [editing, setEditing] = useState<string | null>(null); // goal id or 'new'
  const today = todayISO();
  const monthly = goals.reduce((a, g) => a + goalMonthly(g, today), 0);

  return (
    <Screen scroll>
      <Header title="Goals & planned purchases" />

      <Card dark style={{ gap: 4 }}>
        <T v="caption" color={C.onDarkMuted} style={{ fontFamily: F.bodySemi }}>
          Set aside every month
        </T>
        <T color={C.mint} style={{ fontFamily: F.display, fontSize: 28 }}>
          {fmt(monthly, cur)}
        </T>
        <T v="small" color={C.onDarkMuted}>
          {goals.length
            ? 'Kept out of your daily limit, like savings, so each goal is ready by its date.'
            : 'Saving up for a phone, a trip or a festival? Add it and Pace works out how much to put aside each month.'}
        </T>
      </Card>

      {goals.map((g) =>
        editing === g.id ? (
          <GoalForm key={g.id} goal={g} cur={cur} onDone={() => setEditing(null)} />
        ) : (
          <GoalCard key={g.id} goal={g} cur={cur} onEdit={() => setEditing(g.id)} />
        ),
      )}

      {editing === 'new' ? (
        <GoalForm cur={cur} onDone={() => setEditing(null)} />
      ) : (
        <Button kind="secondary" label="Add a goal" onPress={() => setEditing('new')} />
      )}
    </Screen>
  );
}

function GoalCard({ goal: g, cur, onEdit }: { goal: Goal; cur: CurrencyCode; onEdit: () => void }) {
  const [adding, setAdding] = useState(false);
  const [amt, setAmt] = useState<number | null>(null);
  const today = todayISO();
  const per = goalMonthly(g, today);
  const done = g.saved >= g.amount;
  const late = !done && g.targetDate < today;

  const addMoney = () => {
    if (!amt) return;
    const goals = getState().profile.goals ?? [];
    saveGoals(goals.map((x) => (x.id === g.id ? { ...x, saved: (Number(x.saved) || 0) + amt } : x)));
    setAmt(null);
    setAdding(false);
  };

  const remove = () =>
    Alert.alert('Delete this goal?', `“${g.name}” and what you've recorded as saved for it will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => saveGoals((getState().profile.goals ?? []).filter((x) => x.id !== g.id)) },
    ]);

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodySemi">{g.name}</T>
          <T v="caption" color={C.inkMuted}>
            {`By ${prettyDate(g.targetDate)}`}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${g.name}`} hitSlop={8} onPress={onEdit}>
          <Icon name="edit" size={18} color={C.link} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${g.name}`} hitSlop={8} onPress={remove}>
          <Icon name="trash" size={18} color={C.coralInk} />
        </Pressable>
      </View>
      <Bar value={g.amount > 0 ? g.saved / g.amount : 0} color={done ? C.ok : C.mint} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <T v="small" style={{ fontFamily: F.bodySemi }}>
          {`${fmt(g.saved, cur)} of ${fmt(g.amount, cur)}`}
        </T>
        <T v="small" color={done ? C.ok : late ? C.coralInk : C.inkMuted}>
          {done ? 'Ready' : late ? `${fmt(per, cur)} still to go` : `Pace sets aside ${fmt(per, cur)} a month`}
        </T>
      </View>
      {adding ? (
        <View style={{ gap: 8 }}>
          <AmountInput label={`Add money to ${g.name}`} value={amt} onChange={setAmt} currency={cur} autoFocus />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="secondary" label="Cancel" onPress={() => setAdding(false)} style={{ flex: 1 }} />
            <Button small label="Add" disabled={!amt} onPress={addMoney} style={{ flex: 1 }} />
          </View>
        </View>
      ) : !done ? (
        <LinkText label="Add money" icon="plus" onPress={() => setAdding(true)} />
      ) : null}
    </Card>
  );
}

function GoalForm({ goal, cur, onDone }: { goal?: Goal; cur: CurrencyCode; onDone: () => void }) {
  const today = todayISO();
  const [name, setName] = useState(goal?.name ?? '');
  const [amount, setAmount] = useState<number | null>(goal?.amount ?? null);
  const [saved, setSaved] = useState<number | null>(goal?.saved || null);
  const [date, setDate] = useState<string>(goal?.targetDate ?? addDays(today, 180));
  const ok = name.trim().length > 0 && !!amount;
  const preview: Goal = { id: 'x', name, amount: amount ?? 0, saved: saved ?? 0, targetDate: date, createdAt: today };

  const save = () => {
    if (!ok) return;
    const goals = getState().profile.goals ?? [];
    const next: Goal = {
      id: goal?.id ?? newId('goal'),
      name: name.trim(),
      amount: amount ?? 0,
      saved: saved ?? 0,
      targetDate: date,
      createdAt: goal?.createdAt ?? new Date().toISOString(),
    };
    saveGoals(goal ? goals.map((x) => (x.id === goal.id ? next : x)) : [...goals, next]);
    onDone();
  };

  return (
    <ListCard style={{ paddingVertical: 14, gap: 10, borderColor: C.harbor }}>
      <T v="bodySemi">{goal ? 'Edit goal' : 'New goal'}</T>
      <TextField label="Goal name" value={name} onChange={setName} placeholder="e.g. New phone, Goa trip" autoFocus={!goal} />
      <View style={{ gap: 4 }}>
        <T v="caption" color={C.inkMuted}>
          How much it costs
        </T>
        <AmountInput label="Goal amount" value={amount} onChange={setAmount} currency={cur} />
      </View>
      <View style={{ gap: 4 }}>
        <T v="caption" color={C.inkMuted}>
          Already put aside (optional)
        </T>
        <AmountInput label="Already saved" value={saved} onChange={setSaved} currency={cur} />
      </View>
      <DateField label="Needed by" value={date} onChange={setDate} minimumDate={addDays(today, 1)} />
      {ok ? (
        <T v="small" color={C.inkMuted}>
          {goalMonthly(preview, today) > 0 ? `Pace will set aside ${fmt(goalMonthly(preview, today), cur)} a month for this.` : 'Already fully saved.'}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small kind="secondary" label="Cancel" onPress={onDone} style={{ flex: 1 }} />
        <Button small label={goal ? 'Save' : 'Add goal'} disabled={!ok} onPress={save} style={{ flex: 1 }} />
      </View>
    </ListCard>
  );
}
