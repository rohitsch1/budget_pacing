import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Card, Icon, Pill, Ring, Screen, T } from '@/components/ui';
import { addDays, dayPlan, isWorkDay, MONTH_SHORT, parseISODate, prettyDate, WEEKDAY_LONG, WEEKDAY_SHORT } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { DateTile, EntryRow, LinkText, PendingBanner } from '@/features/core/components';
import { billsInCycle, cycleSummary, editRoute, entriesOn, greeting, overPlan, planTotalsEmpty } from '@/features/core/helpers';
import { scheduleReminders } from '@/features/reminders';
import { actions, useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

const STATUS = {
  ok: { label: 'On track', bg: C.okSoft, fg: C.ok },
  tight: { label: 'Getting tight', bg: C.amberSoft, fg: C.amber },
  over: { label: 'Over today', bg: C.coralSoft, fg: C.coralInk },
} as const;

export default function Today() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const seenShareHowTo = useStore((s) => s.seenShareHowTo);
  const [overAck, setOverAck] = useState<string | null>(null);

  const plan = useMemo(() => dayPlan(profile, entries), [profile, entries]);
  const cycle = cycleSummary(plan);
  const bills = useMemo(() => billsInCycle(profile, plan), [profile, plan]);
  const todays = useMemo(() => entriesOn(entries, plan.date), [entries, plan.date]);
  const newPlan = useMemo(() => overPlan(profile, entries, plan), [profile, entries, plan]);
  const cur = profile.currency;

  // Keep the morning reminder amount in step with today's numbers (no-op without permission).
  useEffect(() => {
    scheduleReminders(profile);
  }, [profile, plan.limit]);

  const now = new Date();
  const d = parseISODate(plan.date);
  const work = isWorkDay(profile, plan.date);
  const over = plan.status === 'over';
  const dateLine = `${WEEKDAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} · ${
    over ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : work ? 'office day' : 'weekend day'
  }`;
  const name = profile.name.trim();
  const usedPct = plan.limit > 0 ? Math.round((plan.spentToday / plan.limit) * 100) : plan.spentToday > 0 ? 100 : 0;
  const st = STATUS[plan.status];
  const noPlan = planTotalsEmpty(profile);
  const nextBill = bills.upcoming[0];
  const paydayDate = addDays(plan.cycle.end, 1);

  return (
    <Screen scroll>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="small" color={C.inkMuted}>
            {dateLine}
          </T>
          <T v="h2">{name ? `${greeting(now)}, ${name}` : greeting(now)}</T>
        </View>
        {!over ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reminders"
            onPress={() => router.push('/settings')}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bell" size={20} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          onPress={() => router.push('/settings')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
          <T v="h3" style={{ fontFamily: F.displayBold, fontSize: 15 }}>
            {(name[0] ?? 'P').toUpperCase()}
          </T>
        </Pressable>
      </View>

      {/* Hero: today's limit */}
      <Animated.View entering={FadeInDown.duration(500)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${over ? 'Over today by' : 'Left today'} ${fmt(Math.abs(plan.left), cur)}. Today's limit ${fmt(plan.limit, cur)}. See how it works`}
          onPress={() => router.push('/daily-detail')}
          style={({ pressed }) => ({ backgroundColor: C.harbor, borderRadius: R.xl, padding: 20, gap: 16, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <Ring
              size={120}
              stroke={12}
              value={over ? (plan.limit > 0 ? -plan.left / plan.limit : 1) : usedPct / 100}
              color={over ? C.coral : C.mint}
              track={over ? C.mint : C.harborLine}>
              <T v="h3" color={C.onDark} style={{ fontFamily: F.display, fontSize: 18 }}>
                {usedPct}%
              </T>
            </Ring>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="label" color={C.onDarkMuted} style={{ letterSpacing: 0.8, fontFamily: F.bodySemi }}>
                {over ? 'OVER TODAY BY' : 'LEFT TODAY'}
              </T>
              <T v="number" color={over ? C.coral : C.onDark} style={{ fontSize: 40, lineHeight: 44 }} adjustsFontSizeToFit numberOfLines={1}>
                {fmt(plan.left, cur)}
              </T>
              <Pill label={st.label} bg={st.bg} fg={st.fg} style={{ marginTop: 6 }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <HeroStat label="Today's limit" value={fmt(plan.limit, cur)} />
            <HeroStat label={over ? 'Spent' : 'Spent so far'} value={fmt(plan.spentToday, cur)} />
          </View>
        </Pressable>
      </Animated.View>

      <PendingBanner />

      {noPlan ? (
        <Card>
          <T v="bodySemi">Your plan is empty</T>
          <T v="small" color={C.inkMuted}>
            Add your income and bills so Pace can work out what you can spend each day.
          </T>
          <LinkText label="Add income" onPress={() => router.push(editRoute('income'))} />
        </Card>
      ) : null}

      {/* Over: the new plan */}
      {over && newPlan && overAck !== plan.date ? (
        <Card style={{ gap: 12 }}>
          <T v="bodySemi" style={{ fontSize: 16 }}>
            {"That's fine, here's the new plan"}
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <NewLimit label={`Tomorrow (${WEEKDAY_SHORT[parseISODate(newPlan.tomorrow).getDay()]})`} now={newPlan.tomorrowNow} was={newPlan.tomorrowWas} cur={cur} />
            {newPlan.other ? (
              <NewLimit label={newPlan.otherIsWork ? 'Next office day' : 'Next weekend day'} now={newPlan.otherNow} was={newPlan.otherWas} cur={cur} />
            ) : null}
          </View>
          <T v="small" color={C.inkMuted} style={{ fontSize: 14, lineHeight: 21 }}>
            {`The extra ${fmt(newPlan.over, cur)} is spread over the ${newPlan.daysLeft} ${newPlan.daysLeft === 1 ? 'day' : 'days'} left${
              newPlan.lessPerWorkDay > 0 ? `, about ${fmt(newPlan.lessPerWorkDay, cur)} less on an office day` : ''
            }. Your bills and savings are untouched.`}
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small label="Got it" onPress={() => setOverAck(plan.date)} style={{ flex: 1 }} />
            <Button
              small
              kind="secondary"
              label="Mark as one-off"
              style={{ flex: 1 }}
              onPress={() => {
                setOverAck(plan.date);
                Alert.alert('Marked as one-off', "Pace won't treat today as your new normal. The rest of your plan stays the same.");
              }}
            />
          </View>
        </Card>
      ) : null}

      {/* This cycle + payday */}
      {over ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
              This cycle
            </T>
            {cycle.left >= 0 ? <Pill label="Still on track" bg={C.okSoft} fg={C.ok} /> : <Pill label="Over for the cycle" bg={C.coralSoft} fg={C.coralInk} />}
          </View>
          <T v="h2">
            {fmt(cycle.left, cur)}{' '}
            <T v="small" color={C.inkMuted} style={{ fontFamily: F.bodyMed }}>
              {`left of ${fmt(plan.flexibleTotal, cur)} · ${plan.daysLeft - 1} days`}
            </T>
          </T>
          <ThinBar value={cycle.fraction} />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card style={{ flex: 3, padding: 14 }}>
            <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
              This cycle
            </T>
            <T v="h2">
              {fmt(cycle.left, cur)}{' '}
              <T v="small" color={C.inkMuted} style={{ fontFamily: F.bodyMed }}>
                {`left of ${fmt(plan.flexibleTotal, cur)}`}
              </T>
            </T>
            <ThinBar value={cycle.fraction} />
            <T v="caption" color={C.inkMuted}>
              {`Day ${cycle.dayIndex} of ${plan.cycle.days} · ${Math.max(0, Math.round(cycle.fraction * 100))}% spent`}
            </T>
          </Card>
          <Card style={{ flex: 2, padding: 14 }}>
            <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
              Payday in
            </T>
            <T v="h2">{`${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'}`}</T>
            <T v="caption" color={C.inkMuted}>
              {prettyDate(paydayDate)}
            </T>
          </Card>
        </View>
      )}

      {/* One-time share how-to */}
      {!seenShareHowTo ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.mintSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="share" size={20} />
          </View>
          <Pressable
            accessibilityRole="button"
            style={{ flex: 1, gap: 2 }}
            onPress={() => {
              actions.markShareHowToSeen();
              router.push('/share/how-to');
            }}>
            <T v="bodySemi">Add payments from any app</T>
            <T v="caption" color={C.inkMuted}>
              Share the payment screen to Pace. Two taps, no typing.
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} onPress={() => actions.markShareHowToSeen()}>
            <Icon name="close" size={18} color={C.inkFaint} />
          </Pressable>
        </Card>
      ) : null}

      {/* Next bill */}
      {!over && nextBill ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/plan')}
          style={({ pressed }) => ({
            backgroundColor: C.white,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: R.lg,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            opacity: pressed ? 0.7 : 1,
          })}>
          <DateTile date={nextBill.date} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="bodySemi">{`${nextBill.name} · ${fmt(nextBill.amount, cur)}`}</T>
            <T v="caption" color={C.inkMuted}>
              {bills.upcoming.length > 1
                ? `Already set aside · ${bills.upcoming.length - 1} more ${bills.upcoming.length === 2 ? 'bill' : 'bills'} this cycle`
                : 'Already set aside · last bill this cycle'}
            </T>
          </View>
          <Icon name="chevron" size={18} />
        </Pressable>
      ) : null}

      {/* Today's spends */}
      {!over ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T v="h3" style={{ fontFamily: F.display }}>
              Today
            </T>
            <LinkText label="See all" onPress={() => router.push('/activity')} />
          </View>
          {todays.length ? (
            todays.slice(0, 6).map((e, i, a) => <EntryRow key={e.id} entry={e} last={i === a.length - 1} />)
          ) : (
            <T v="small" color={C.inkMuted} style={{ paddingVertical: 12 }}>
              Nothing logged today yet. Tap + to add a spend.
            </T>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.harborMid, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
      <T v="caption" color={C.onDarkMuted}>
        {label}
      </T>
      <T v="h3" color={C.onDark} style={{ fontFamily: F.display, fontSize: 18 }}>
        {value}
      </T>
    </View>
  );
}

function NewLimit({ label, now, was, cur }: { label: string; now: number; was: number; cur: Parameters<typeof fmt>[1] }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="caption" color={C.inkMuted}>
        {label}
      </T>
      <T v="h2">
        {fmt(now, cur)}{' '}
        {was !== now ? (
          <T v="small" color={C.inkMuted} style={{ fontFamily: F.bodyMed, fontSize: 14, textDecorationLine: 'line-through' }}>
            {fmt(was, cur)}
          </T>
        ) : null}
      </T>
    </View>
  );
}

function ThinBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: '#EDE9E0', overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height: '100%', backgroundColor: C.ink }} />
    </View>
  );
}
