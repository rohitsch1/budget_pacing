import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { Button, Card, Chip, Header, Screen, T } from '@/components/ui';
import { entryDate, prettyDate } from '@/domain/budget';
import { fmt, SYMBOL } from '@/domain/money';
import type { Entry } from '@/domain/types';
import { CatBadge, Row } from '@/features/core/components';
import { timeOf } from '@/features/core/helpers';
import { actions, useStore } from '@/store';
import { C, CATEGORIES, F, R } from '@/theme/tokens';

const KIND_TITLE: Record<Entry['kind'], string> = { expense: 'Expense', refund: 'Refund', payback: 'Paid back', income: 'Money in' };
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

  const parsed = Number(amount.replace(/,/g, ''));
  const valid = Number.isFinite(parsed) && parsed > 0;
  const dirty =
    (valid && parsed !== entry.amount) || category !== entry.category || payee.trim() !== (entry.payee ?? '') || note.trim() !== (entry.note ?? '');
  const cats: string[] = entry.kind === 'expense' ? [...CATEGORIES] : Array.from(new Set([entry.category, ...CATEGORIES]));

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
        <Header title={KIND_TITLE[entry.kind]} />
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
          <T v="small" color={C.inkMuted}>
            {`${prettyDate(entryDate(entry))}${timeOf(entry) ? ` · ${timeOf(entry)}` : ''}`}
          </T>
        </View>

        <T v="label" color={C.inkMuted}>
          CATEGORY
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((c) => (
            <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />
          ))}
        </View>

        <T v="label" color={C.inkMuted}>
          PAID TO
        </T>
        <TextInput value={payee} onChangeText={setPayee} placeholder="Merchant or person" placeholderTextColor={C.inkFaint} style={input} />

        <T v="label" color={C.inkMuted}>
          NOTE
        </T>
        <TextInput value={note} onChangeText={setNote} placeholder="Add a note" placeholderTextColor={C.inkFaint} style={input} />

        <Card style={{ paddingVertical: 4, gap: 0, borderRadius: R.lg }}>
          {entry.method ? <Row label="Paid with" value={entry.methodTag ? `${entry.method} · ${entry.methodTag}` : entry.method} /> : null}
          {entry.app ? <Row label="App" value={entry.app} /> : null}
          {entry.ref ? <Row label="Reference" value={entry.ref} /> : null}
          <Row label="Source" value={SOURCE[entry.source]} />
          <Row label="Counts toward daily limit" value={entry.countsToBudget ? 'Yes' : 'No'} last />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
