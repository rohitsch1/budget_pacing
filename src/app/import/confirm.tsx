import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { Button, Chip, Header, Icon, Pill, Screen, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { finishSession, impactOf, localNowISO, mergeIntoExisting, runPipeline, saveFromSession } from '@/features/capture/pipeline';
import { getSession, patchSession, type CaptureSession } from '@/features/capture/session';
import { goHome, Thumb, whenLabel } from '@/features/capture/ui';
import { useStore } from '@/store';
import { C, CATEGORIES, F, R } from '@/theme/tokens';

type FieldKey = 'amount' | 'payee' | 'when' | 'category' | 'method';

export default function ImportConfirm() {
  const params = useLocalSearchParams<{ sid?: string; pendingId?: string }>();
  const [session, setSession] = useState<CaptureSession | null>(() => getSession(params.sid));
  const [loading, setLoading] = useState(!session && !!params.pendingId);
  const started = useRef(false);

  useEffect(() => {
    if (session || !params.pendingId || started.current) return;
    started.current = true;
    runPipeline({ pendingId: params.pendingId, source: 'share' })
      .then((r) => setSession(r.session))
      .finally(() => setLoading(false));
  }, [session, params.pendingId]);

  if (loading) {
    return (
      <Screen>
        <Header title="Is this right?" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.harbor} />
          <T v="small" color={C.inkMuted}>
            Reading your payment…
          </T>
        </View>
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen footer={<Button label="Type it instead" onPress={() => router.replace('/add-expense')} />}>
        <Header title="Is this right?" />
        <T v="body" color={C.inkMuted}>
          This receipt isn&apos;t open any more. Share it to Pace again, or type the amount.
        </T>
      </Screen>
    );
  }
  return <ConfirmForm session={session} />;
}

function ConfirmForm({ session }: { session: CaptureSession }) {
  const p = session.parsed;
  const currency = useStore((s) => s.profile.currency);
  const entries = useStore((s) => s.entries);
  const dup = session.duplicateId ? entries.find((e) => e.id === session.duplicateId) : undefined;

  const [amount, setAmount] = useState(p.amount !== null ? String(p.amount) : '');
  const [payee, setPayee] = useState(p.payee ?? '');
  const [category, setCategory] = useState(p.category ?? 'Other');
  const [method, setMethod] = useState(p.method ?? '');
  const [whenMode, setWhenMode] = useState<'read' | 'now'>(p.at ? 'read' : 'now');
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [showDup, setShowDup] = useState(!!dup);

  const n = parseFloat(amount.replace(/,/g, '')) || 0;
  const cur = p.currency ?? currency;
  const at = whenMode === 'read' && p.at ? p.at : localNowISO();
  void entries;
  const { after } = impactOf({ kind: 'expense', amount: n, at });

  const clear = p.confidence >= 0.75 && p.direction === 'out';

  const add = () => {
    if (!n) return;
    saveFromSession(session.id, { amount: n, payee: payee.trim() || null, category, method: method.trim() || null, at });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    goHome();
  };

  const notExpense = () => {
    patchSession(session.id, { amount: n || p.amount, payee: payee.trim() || p.payee });
    router.replace({ pathname: '/share/received', params: { sid: session.id } });
  };

  const rows: { k: FieldKey; l: string; v: string; check: boolean }[] = [
    { k: 'payee', l: p.direction === 'in' ? 'From' : 'Paid to', v: payee || 'Add who you paid', check: !payee },
    { k: 'when', l: 'When', v: whenLabel(at), check: !p.at && whenMode === 'now' },
    { k: 'category', l: p.category ? 'Category (suggested)' : 'Category', v: category, check: !p.category },
    { k: 'method', l: 'Paid with', v: method || 'Not shown on the receipt', check: false },
  ];

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={n ? 'Add expense' : 'Enter an amount'} disabled={!n} onPress={add} />
          <Button kind="ghost" label="Not an expense (refund, transfer to self…)" onPress={notExpense} />
        </>
      }>
      <Header title="Is this right?" right={<Thumb uri={session.imageUri} />} />

      <View style={{ alignItems: 'center', gap: 6, paddingTop: 2 }}>
        {editing === 'amount' ? (
          <TextInput
            autoFocus
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
            onBlur={() => setEditing(null)}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount"
            style={{ fontFamily: F.display, fontSize: 48, color: C.ink, minWidth: 120, textAlign: 'center', borderBottomWidth: 2, borderColor: C.mint }}
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={`Amount ${n ? fmt(n, cur) : 'missing'}. Edit`} onPress={() => setEditing('amount')}>
            <T v="number" style={{ fontSize: 48, lineHeight: 52 }} color={n ? C.ink : C.inkDisabled}>
              {n ? fmt(n, cur) : fmt(0, cur)}
            </T>
          </Pressable>
        )}
        {clear ? <Pill label="Read clearly" bg={C.okSoft} fg={C.ok} /> : <Pill label={p.direction === 'pending' ? 'Shows as pending, please check' : 'Please check'} bg={C.amberSoft} fg={C.amber} />}
      </View>

      {dup && showDup ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: 16, padding: 14, gap: 10 }}>
          <T v="bodySemi" color={C.amberInk} style={{ fontSize: 14 }}>
            Looks like one you already added
          </T>
          <T v="small" color={C.amberInk}>
            {`“${dup.note || dup.payee || dup.category}”, ${fmt(dup.amount, dup.currency)}, ${dup.source === 'manual' ? 'typed in by you' : 'added from a receipt'} ${whenLabel(dup.at).replace('Today, ', 'at ')}.`}
            {dup.ref && p.ref && dup.ref.slice(-4) === p.ref.slice(-4) ? ' Same reference, same amount.' : ' Same amount, a few minutes apart.'}
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                mergeIntoExisting(session.id, dup.id);
                goHome();
              }}
              style={{ flex: 1, height: 40, borderRadius: R.pill, backgroundColor: C.amberInk, alignItems: 'center', justifyContent: 'center' }}>
              <T v="small" color={C.white} style={{ fontFamily: F.bodySemi }}>
                Same payment, merge
              </T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDup(false)}
              style={{ flex: 1, height: 40, borderRadius: R.pill, borderWidth: 1, borderColor: '#C79A4A', alignItems: 'center', justifyContent: 'center' }}>
              <T v="small" color={C.amberInk} style={{ fontFamily: F.bodySemi }}>
                Different, keep both
              </T>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 2 }}>
        {rows.map((r, i) => (
          <View key={r.k} style={{ borderBottomWidth: i < rows.length - 1 || p.ref ? 1 : 0, borderColor: C.lineSoft, paddingVertical: 8, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="caption" color={C.inkMuted}>
                  {r.l}
                </T>
                {editing === r.k && (r.k === 'payee' || r.k === 'method') ? (
                  <TextInput
                    autoFocus
                    value={r.k === 'payee' ? payee : method}
                    onChangeText={r.k === 'payee' ? setPayee : setMethod}
                    onBlur={() => setEditing(null)}
                    returnKeyType="done"
                    accessibilityLabel={r.l}
                    style={{ fontFamily: F.bodySemi, fontSize: 15, color: C.ink, paddingVertical: 2, borderBottomWidth: 1, borderColor: C.mint }}
                  />
                ) : (
                  <T v="bodySemi" color={r.check && (r.k === 'payee' && !payee) ? C.inkFaint : C.ink}>
                    {r.v}
                  </T>
                )}
              </View>
              {r.check ? <Pill label="Please check" bg={C.amberSoft} fg={C.amber} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${r.l}`}
                hitSlop={6}
                onPress={() => {
                  if (r.k === 'when') setWhenMode(whenMode === 'read' && p.at ? 'now' : p.at ? 'read' : 'now');
                  else setEditing(editing === r.k ? null : r.k);
                }}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="edit" size={16} color={C.inkMuted} />
              </Pressable>
            </View>
            {editing === 'category' && r.k === 'category' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 }}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={c === category}
                    onPress={() => {
                      setCategory(c);
                      setEditing(null);
                    }}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {p.ref ? (
          <View style={{ minHeight: 56, justifyContent: 'center', gap: 2 }}>
            <T v="caption" color={C.inkMuted}>
              Reference
            </T>
            <T v="bodySemi">{`${p.app ? p.app + ' ref' : 'Ref'} ••${p.ref.slice(-4)}`}</T>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
        <Icon name="info" size={16} color={C.inkMuted} />
        <T v="small" color={C.inkMuted} style={{ flex: 1 }}>
          {n
            ? after.left >= 0
              ? `After this, ${fmt(after.left, currency)} left today.`
              : `After this, ${fmt(-after.left, currency)} over today. Tomorrow adjusts.`
            : 'Type the amount to see what it does to today.'}
        </T>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          finishSession(session.id);
          goHome();
        }}
        style={{ alignSelf: 'center', padding: 6 }}>
        <T v="caption" color={C.inkFaint}>
          Discard this receipt
        </T>
      </Pressable>
    </Screen>
  );
}
