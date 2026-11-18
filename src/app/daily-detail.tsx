import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Header, Icon, Screen, T } from '@/components/ui';
import { addDays, dayPlan, isWorkDay, parseISODate, planTotals, projectedLimits, WEEKDAY_LONG } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { Row } from '@/features/core/components';
import { billsInCycle, countFrom, joinDates, ordinal, shortDay } from '@/features/core/helpers';
import { useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

export default function DailyDetail() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const plan = useMemo(() => dayPlan(profile, entries), [profile, entries]);
  const bars = useMemo(() => projectedLimits(profile, entries, plan.date, plan.daysLeft), [profile, entries, plan]);
  const bills = useMemo(() => billsInCycle(profile, plan), [profile, plan]);
  const cur = profile.currency;
  const ww = profile.weekendWeight || 1.6;

  const from = countFrom(profile, plan);
  const yesterday = addDays(plan.date, -1);
  const spentLabel =
    from > yesterday
      ? 'Spent before today'
      : from === yesterday
        ? `Spent ${shortDay(from)}`
        : parseISODate(from).getMonth() === parseISODate(yesterday).getMonth()
          ? `Spent ${parseISODate(from).getDate()}–${shortDay(yesterday)}`
          : `Spent ${shortDay(from)} – ${shortDay(yesterday)}`;

  // Extras reserved (today + upcoming)
  const extraDates = [...(plan.extraToday ? [plan.date] : []), ...plan.upcomingExtras.map((x) => x.date)];
  const labels = Array.from(new Set(profile.dayExtras.map((x) => x.label).filter(Boolean)));
  const extraWeekdays = Array.from(new Set(profile.dayExtras.map((x) => x.weekday)));
  const extraTitle =
    labels.length === 1 && extraWeekdays.length === 1
      ? `${WEEKDAY_LONG[extraWeekdays[0]]} ${labels[0].toLowerCase()} first`
      : 'Day extras first';
  const pool = Math.max(0, plan.remaining - plan.extrasReserved);
  const shares = Math.round(plan.sumWeights * 10) / 10;
  const todayWork = isWorkDay(profile, plan.date);

  // kept out of the number
  const kept: string[] = [];
  if (bills.upcoming.length)
    kept.push(`${fmt(bills.totalUpcoming, cur)} for ${bills.upcoming.length} ${bills.upcoming.length === 1 ? 'bill' : 'bills'} due before payday`);
  const totals = planTotals(profile, plan.date);
  const monthly = (profile.payFrequency ?? 'monthly') === 'monthly';
  const perMonth = monthly ? '' : ' a month';
  if (totals.savings > 0) kept.push(`${fmt(totals.savings, cur)} savings${perMonth}`);
  if (totals.goals > 0) {
    const n = (profile.goals ?? []).length;
    kept.push(`${fmt(totals.goals, cur)}${perMonth} for ${n === 1 ? 'your goal' : `${n} goals`}`);
  }
  if (totals.routine > 0) {
    const names = profile.routineItems.map((x) => x.name.toLowerCase()).filter(Boolean).slice(0, 4);
    kept.push(`${fmt(totals.routine, cur)} routine${perMonth}${names.length ? ` (${names.join(', ')})` : ''}`);
  }
  if (totals.irregularBuffer > 0) kept.push(`${fmt(totals.irregularBuffer, cur)}${perMonth} buffer in case income comes in lower`);
  let keptText = kept.join(' · ');
  if (keptText && !monthly) keptText += `. Monthly amounts are scaled to your ${plan.cycle.days}-day pay cycle`;
  if (bills.passed.length) {
    const names = bills.passed.map((b) => b.name);
    const days = Array.from(new Set(bills.passed.map((b) => ordinal(parseISODate(b.date).getDate()))));
    keptText += `${keptText ? '. ' : ''}${names.join(', ')} ${names.length === 1 ? 'was' : 'were'} paid on the ${days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}` : days[0]}.`;
  }

  const max = Math.max(1, ...bars.map((b) => b.limit));
  const extraWd = extraWeekdays.length === 1 ? WEEKDAY_LONG[extraWeekdays[0]] : 'extra days';
  const legend = profile.dayExtras.length ? `Tallest = weekend · mid = ${extraWd}` : 'Taller = weekend';
  const labelEvery = bars.length > 16 ? 2 : 1;

  return (
    <Screen scroll>
      <Header title="How today's limit works" />
      <Card style={{ paddingVertical: 6, gap: 0 }}>
        <Row label={profile.start && from === profile.start.date ? `Free to spend from ${shortDay(from)}` : 'Free to spend this cycle'} value={fmt(plan.flexibleTotal, cur)} />
        <Row label={spentLabel} value={fmt(-plan.spentBefore, cur)} />
        <Row label="Left this morning" value={fmt(plan.remaining, cur)} strong />
        {plan.extrasReserved > 0 ? (
          <Row
            label={extraTitle}
            sub={`${extraDates.length} left this cycle: ${joinDates(extraDates)}`}
            value={fmt(-plan.extrasReserved, cur)}
          />
        ) : null}
        <Row
          label={`${fmt(pool, cur)} over ${plan.daysLeft} ${plan.daysLeft === 1 ? 'day' : 'days'}`}
          sub={`${plan.workDaysLeft} office ${plan.workDaysLeft === 1 ? 'day' : 'days'} + ${plan.weekendDaysLeft} weekend ${plan.weekendDaysLeft === 1 ? 'day' : 'days'} × ${ww}`}
          value={`${shares} shares`}
        />
        <Row label="One share (an office day)" value={fmt(plan.perWorkDay, cur)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 8 }}>
          <T v="bodySemi" style={{ fontFamily: F.bodyBold, flex: 1 }}>
            {`Today, ${todayWork ? 'an office day' : 'a weekend day'}${plan.extraTodayLabel ? ` + ${plan.extraTodayLabel}` : ''}`}
          </T>
          <View style={{ backgroundColor: C.mintSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <T v="h2" style={{ fontFamily: F.displayBold, fontSize: 20 }}>
              {fmt(plan.limit, cur)}
            </T>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: F.bodySemi }}>
          Already kept out of this number
        </T>
        <T v="small" color={C.inkMuted} style={{ lineHeight: 20 }}>
          {keptText || 'Nothing yet. Add bills, routine costs or savings in your plan and they will be kept out first.'}
        </T>
      </Card>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <T v="h3" style={{ fontFamily: F.display }}>
            {`Your next ${bars.length} ${bars.length === 1 ? 'day' : 'days'}`}
          </T>
          <T v="caption" color={C.inkMuted}>
            {legend}
          </T>
        </View>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Daily limits for the next ${bars.length} days: ${fmt(plan.perWorkDay, cur)} on office days, ${fmt(plan.perWeekendDay, cur)} on weekend days`}
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: bars.length > 20 ? 2 : 4, height: 110 }}>
          {bars.map((b, i) => (
            <View key={b.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, (b.limit / max) * 88),
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  borderBottomLeftRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: i === 0 ? C.harbor : !b.work ? '#7CCFA9' : b.extra ? '#8CC5CF' : C.btnLine,
                }}
              />
              <T v="caption" color={C.inkMuted} style={{ fontSize: 10, fontFamily: i === 0 ? F.bodyBold : F.bodyMed }}>
                {i % labelEvery === 0 ? parseISODate(b.date).getDate() : ' '}
              </T>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/goals')}
        style={({ pressed }) => ({ backgroundColor: C.harbor, borderRadius: R.lg, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.85 : 1 })}>
        <Icon name="star" size={20} color={C.mint} />
        <T v="small" color={C.onDark} style={{ flex: 1, lineHeight: 19 }}>
          Planning something big? Add a goal and Pace sets money aside each month.
        </T>
        <Icon name="chevron" size={18} color={C.onDark} />
      </Pressable>
    </Screen>
  );
}
