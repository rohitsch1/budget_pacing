import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { File } from 'expo-file-system';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

import { DateTimeField } from '@/components/DateTimeField';
import { Button, Header, Icon, Pill, Screen, T } from '@/components/ui';
import { fmt, SYMBOL } from '@/domain/money';
import type { PendingImport } from '@/domain/types';
import { finishSession, impactOf, localNowISO, mergeIntoExisting, runPipeline, saveFromSession } from '@/features/capture/pipeline';
import { matchPlanned } from '@/features/capture/planned';
import { getSession, patchSession, type CaptureSession } from '@/features/capture/session';
import { CategoryPicker, goHome, PlannedToggle, Thumb, whenLabel } from '@/features/capture/ui';
import { actions, getState, useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

type FieldKey = 'amount' | 'payee' | 'when' | 'category' | 'method';

/** Can a saved pending item still be read? Text always can; an image only while its file is there. */
function readable(p: PendingImport): boolean {
  if (p.text && p.text.trim()) return true;
  if (!p.imageUri) return false;
  if (!p.imageUri.startsWith('file:')) return true; // content:// etc: let the reader try
  try {
    return new File(p.imageUri).exists;
  } catch {
    return false;
  }
}

export default function ImportConfirm() {
  const params = useLocalSearchParams<{ sid?: string; pendingId?: string }>();
  const [session, setSession] = useState<CaptureSession | null>(() => getSession(params.sid));
  const [pending] = useState<PendingImport | undefined>(() => (params.pendingId ? getState().pending.find((x) => x.id === params.pendingId) : undefined));
  const [gone, setGone] = useState(() => !session && !!pending && !readable(pending));
  const [loading, setLoading] = useState(!session && !!pending && !gone);
  const started = useRef(false);
  const waiting = useStore((s) => s.pending.length);

  // Resuming a receipt saved earlier: read it again and go wherever a fresh share would have gone.
  useEffect(() => {
    if (session || !pending || gone || started.current) return;
    started.current = true;
    runPipeline({ pendingId: pending.id, source: pending.source === 'screenshot' ? 'screenshot' : 'share' })
      .then((r) => {
        if (r.route === 'quick' || r.route === '/import/confirm') setSession(r.session);
        else router.replace({ pathname: r.route, params: { sid: r.session.id } });
      })
      .catch(() => setGone(true))
      .finally(() => setLoading(false));
  }, [session, pending, gone]);

  if (gone && pending) {
    const discard = () => {
      actions.removePending(pending.id);
      const next = getState().pending[0];
      if (next) router.replace({ pathname: '/import/confirm', params: { pendingId: next.id } });
      else goHome();
    };
    return (
      <Screen
        footer={
          <>
            <Button label="Discard it" onPress={discard} />
            <Button
              kind="ghost"
              label="Type the amount instead"
              onPress={() => {
                actions.removePending(pending.id);
                router.replace('/add-expense');
              }}
            />
          </>
        }>
        <Header title="Can't open this one" />
        <T v="body" color={C.inkMuted}>
          The screenshot saved for later isn&apos;t on your phone any more, so Pace can&apos;t read it. Discard it, or type the amount yourself.
        </T>
        {waiting > 1 ? (
          <T v="small" color={C.inkMuted}>{`${waiting - 1} more waiting after this one.`}</T>
        ) : null}
      </Screen>
    );
  }

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
  const profile = useStore((s) => s.profile);
  const currency = profile.currency;
  const entries = useStore((s) => s.entries);
  const waiting = useStore((s) => s.pending.length);
  const dup = session.duplicateId ? entries.find((e) => e.id === session.duplicateId) : undefined;

  const [amount, setAmount] = useState(p.amount !== null ? String(p.amount) : '');
  const [payee, setPayee] = useState(p.payee ?? '');
  const [category, setCategory] = useState(p.category ?? 'Other');
  const [method, setMethod] = useState(p.method ?? '');
  const [at, setAt] = useState<string>(() => p.at ?? localNowISO());
  const [whenTouched, setWhenTouched] = useState(false);
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [showDup, setShowDup] = useState(!!dup);
  const [plannedChoice, setPlannedChoice] = useState<boolean | null>(null);
  const [homeAmount, setHomeAmount] = useState('');

  const n = parseFloat(amount.replace(/,/g, '')) || 0;
  const cur = p.currency ?? currency;
  const foreign = cur !== currency;
  const home = parseFloat(homeAmount.replace(/,/g, '')) || 0;
  // what is stored / counted: the home-currency amount when the receipt is in another currency
  const saveAmount = foreign ? home : n;
  const match = saveAmount ? matchPlanned(profile, saveAmount, payee) : null;
  const planned = plannedChoice ?? (category === 'Bills' || !!match);
  void entries;
  const { after } = impactOf({ kind: 'expense', amount: saveAmount, at, countsToBudget: !planned });

  const clear = p.confidence >= 0.75 && p.direction === 'out';

  const add = () => {
    if (!saveAmount) return;
    saveFromSession(session.id, {
      amount: saveAmount,
      currency: foreign ? currency : cur,
      payee: payee.trim() || null,
      category,
      method: method.trim() || null,
      at,
      countsToBudget: !planned,
      note: foreign && n ? [p.note, `Paid ${fmt(n, cur)}`].filter(Boolean).join(' · ') : undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    goHome();
  };

  const notExpense = () => {
    patchSession(session.id, { amount: n || p.amount, payee: payee.trim() || p.payee });
    router.replace({ pathname: '/share/received', params: { sid: session.id } });
  };

  const rows: { k: FieldKey; l: string; v: string; check: boolean }[] = [
    { k: 'payee', l: p.direction === 'in' ? 'From' : 'Paid to', v: payee || 'Add who you paid', check: !payee },
    { k: 'when', l: 'When', v: '', check: !p.at && !whenTouched },
    { k: 'category', l: p.category ? 'Category (suggested)' : 'Category', v: category, check: !p.category },
    { k: 'method', l: 'Paid with', v: method || 'Not shown on the receipt', check: false },
  ];

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label={saveAmount ? 'Add expense' : foreign && n ? `Enter the amount in ${currency}` : 'Enter an amount'}
            disabled={!saveAmount}
            onPress={add}
          />
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
        {waiting > 1 ? (
          <T v="caption" color={C.inkMuted}>{`${waiting - 1} more receipt${waiting > 2 ? 's' : ''} waiting after this`}</T>
        ) : null}
        {clear ? <Pill label="Read clearly" bg={C.okSoft} fg={C.ok} /> : <Pill label={p.direction === 'pending' ? 'Shows as pending, please check' : 'Please check'} bg={C.amberSoft} fg={C.amber} />}
      </View>

      {foreign ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: 16, padding: 14, gap: 10 }}>
          <T v="bodySemi" color={C.amberInk} style={{ fontSize: 14 }}>
            {`This receipt is in ${cur}, your budget is in ${currency}`}
          </T>
          <T v="small" color={C.amberInk}>
            {`Pace doesn't convert currencies. Type what it cost you in ${currency} (check your bank or card statement).`}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: home ? C.line : '#C79A4A' }}>
            <T v="bodySemi" color={C.inkMuted}>
              {SYMBOL[currency].trim()}
            </T>
            <TextInput
              value={homeAmount}
              onChangeText={(t) => setHomeAmount(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={`Amount in ${currency}`}
              placeholderTextColor={C.inkFaint}
              accessibilityLabel={`Amount in ${currency}`}
              style={{ flex: 1, fontFamily: F.bodySemi, fontSize: 16, color: C.ink, paddingVertical: 0 }}
            />
          </View>
        </View>
      ) : null}

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
                ) : r.k === 'when' ? (
                  <DateTimeField
                    value={at}
                    onChange={(v) => {
                      setAt(v);
                      setWhenTouched(true);
                    }}
                    style={{ marginTop: 2 }}
                  />
                ) : (
                  <T v="bodySemi" color={r.check && (r.k === 'payee' && !payee) ? C.inkFaint : C.ink}>
                    {r.v}
                  </T>
                )}
              </View>
              {r.check ? <Pill label="Please check" bg={C.amberSoft} fg={C.amber} /> : null}
              {r.k === 'when' ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${r.l}`}
                hitSlop={6}
                onPress={() => setEditing(editing === r.k ? null : r.k)}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="edit" size={16} color={C.inkMuted} />
              </Pressable>
              )}
            </View>
            {editing === 'category' && r.k === 'category' ? (
              <View style={{ paddingBottom: 6 }}>
                <CategoryPicker
                  value={category}
                  small
                  onChange={(c) => {
                    setCategory(c);
                    setEditing(null);
                  }}
                />
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

      <PlannedToggle
        value={planned}
        onChange={setPlannedChoice}
        hint={match ? `Matches your ${match.kind === 'emi' ? 'EMI' : 'bill'} “${match.name}” (${fmt(match.amount, currency)}). Won't count toward today.` : null}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
        <Icon name="info" size={16} color={C.inkMuted} />
        <T v="small" color={C.inkMuted} style={{ flex: 1 }}>
          {planned && saveAmount
            ? "Planned payment: it's already set aside, so today's limit stays the same."
            : saveAmount
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
