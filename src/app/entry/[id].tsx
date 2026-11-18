import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Switch, TextInput, View } from 'react-native';

import { DateTimeField, formatWhen } from '@/components/DateTimeField';
import { Button, Card, Chip, Header, Screen, T } from '@/components/ui';
import { fmt, SYMBOL } from '@/domain/money';
import type { Entry, EntryKind } from '@/domain/types';
import { CategoryPicker } from '@/features/capture/ui';
import { CatBadge, Row } from '@/features/core/components';
import { actions, useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

const KIND_TITLE: Record<Entry['kind'], string> = { expense: 'Expense', refund: 'Refund', payback: 'Paid back', income: 'Money in' };
const KINDS: { k: EntryKind; l: string }[] = [
  { k: 'expense', l: 'Expense' },
  { k: 'refund', l: 'Refund' },
  { k: 'payback', l: 'Paid back' },
  { k: 'income', l: 'Income' },
];
const SOURCE: Record<Entry['source'], string> = { manual: 'Added by hand', share: 'Shared from another app', screenshot: 'Read from a screenshot' };

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useStore((s) => s.entries.find((e) => e.id === id));
  if (!entry) {
    return (
      <Screen>
        <Header title="Entry" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <T v="bodySemi">This entry no longer exists</T>
          <Button small kind="secondary" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>
      </Screen>
    );
  }
  return <Editor key={entry.id} entry={entry} />;
}

function Editor({ entry }: { entry: Entry }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [category, setCategory] = useState(entry.category);
  const [payee, setPayee] = useState(entry.payee ?? '');
  const [note, setNote] = useState(entry.note ?? '');
  const [at, setAt] = useState(entry.at);
  const [kind, setKind] = useState<EntryKind>(entry.kind);
  const [method, setMethod] = useState(entry.method ?? '');
  const [counts, setCounts] = useState(entry.countsToBudget);
  const refunded = useStore((s) => (entry.refundOf ? s.entries.find((e) => e.id === entry.refundOf) : undefined));

  const parsed = Number(amount.replace(/,/g, ''));
  const valid = Number.isFinite(parsed) && parsed > 0;
  const dirty =
    (valid && parsed !== entry.amount) ||
    category !== entry.category ||
    payee.trim() !== (entry.payee ?? '') ||
    note.trim() !== (entry.note ?? '') ||
    at !== entry.at ||
    kind !== entry.kind ||
    method.trim() !== (entry.method ?? '') ||
    counts !== entry.countsToBudget;

  const changeKind = (k: EntryKind) => {
    setKind(k);
    // money in shows as Income unless it's a refund of a category; going back to expense needs a real category
    if (k === 'income' || k === 'payback') setCategory('Income');
    else if (k === 'expense' && category === 'Income') setCategory('Other');
  };

  const save = () => {
    if (!valid) {
      Alert.alert('Check the amount', 'Enter an amount greater than zero.');
      return;
    }
    actions.updateEntry(entry.id, {
      amount: Math.round(parsed * 100) / 100,
      category,
      payee: payee.trim() || undefined,
      note: note.trim() || undefined,
      at,
      kind,
      method: method.trim() || undefined,
      // a typed-in method no longer matches the old tag
      methodTag: method.trim() === (entry.method ?? '') ? entry.methodTag : undefined,
      countsToBudget: counts,
      refundOf: kind === 'refund' ? entry.refundOf : undefined,
    });
    if (router.canGoBack()) router.back();
  };

  const remove = () => {
    Alert.alert('Delete this entry?', `${fmt(entry.amount, entry.currency)}${entry.payee ? ` · ${entry.payee}` : ''} will be removed and your limits will update.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          actions.deleteEntry(entry.id);
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
      },
    ]);
  };

  const input = {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    paddingHorizontal: 14,
    fontFamily: F.body,
    fontSize: 15,
    color: C.ink,
  } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        scroll
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button kind="secondary" label="Delete" onPress={remove} style={{ flex: 1 }} />
            <Button label="Save" onPress={save} disabled={!dirty} style={{ flex: 2 }} />
          </View>
        }>
        <Header title={KIND_TITLE[kind]} />
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <CatBadge category={category} size={48} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <T v="number" color={C.inkMuted} style={{ fontSize: 36 }}>
              {SYMBOL[entry.currency].trim()}
            </T>
            <TextInput
              accessibilityLabel="Amount"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={{ fontFamily: F.display, fontSize: 46, color: C.ink, minWidth: 80, paddingVertical: 0 }}
            />
          </View>
          {kind === 'refund' && entry.refundOf ? (
            <T v="small" color={C.inkMuted}>
              {refunded
                ? `Refund of ${fmt(refunded.amount, refunded.currency)} · ${refunded.payee || refunded.note || refunded.category}, ${formatWhen(refunded.at)}`
                : 'Refund of a purchase that was deleted'}
            </T>
          ) : null}
        </View>

        <T v="label" color={C.inkMuted}>
          WHEN
        </T>
        <DateTimeField value={at} onChange={setAt} />

        <T v="label" color={C.inkMuted}>
          TYPE
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {KINDS.map((x) => (
            <Chip key={x.k} label={x.l} selected={x.k === kind} onPress={() => changeKind(x.k)} />
          ))}
        </View>

        <T v="label" color={C.inkMuted}>
          CATEGORY
        </T>
        <CategoryPicker value={category} onChange={setCategory} extra={kind === 'expense' ? [] : ['Income']} />
        {refunded && kind === 'refund' ? (
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/entry/[id]', params: { id: refunded.id } })}>
            <T v="small" color={C.link} style={{ fontFamily: F.bodySemi }}>
              Open the purchase this refunds
            </T>
          </Pressable>
        ) : null}

        <T v="label" color={C.inkMuted}>
          PAID TO
        </T>
        <TextInput value={payee} onChangeText={setPayee} placeholder="Merchant or person" placeholderTextColor={C.inkFaint} style={input} />

        <T v="label" color={C.inkMuted}>
          NOTE
        </T>
        <TextInput value={note} onChangeText={setNote} placeholder="Add a note" placeholderTextColor={C.inkFaint} style={input} />

        <T v="label" color={C.inkMuted}>
          {kind === 'expense' ? 'PAID WITH' : 'METHOD'}
        </T>
        <TextInput
          value={method}
          onChangeText={setMethod}
          placeholder="UPI, Card, Cash…"
          placeholderTextColor={C.inkFaint}
          accessibilityLabel="Payment method"
          style={input}
        />

        <Card style={{ paddingVertical: 4, gap: 0, borderRadius: R.lg }}>
          <Row
            label="Counts toward daily limit"
            sub={counts ? undefined : kind === 'expense' ? 'Already in your plan (bill/EMI)' : 'Kept out of your daily limit'}
            right={
              <Switch
                accessibilityLabel="Counts toward daily limit"
                value={counts}
                onValueChange={setCounts}
                trackColor={{ true: C.harbor, false: C.chipLine }}
                thumbColor={C.white}
              />
            }
          />
          {entry.methodTag && method.trim() === (entry.method ?? '') ? <Row label="Account type" value={entry.methodTag} /> : null}
          {entry.app ? <Row label="App" value={entry.app} /> : null}
          {entry.ref ? <Row label="Reference" value={entry.ref} /> : null}
          <Row label="Source" value={SOURCE[entry.source]} last />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
