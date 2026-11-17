import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, Chip, Icon, Pill, Screen, T } from '@/components/ui';
import { addDays, dayPlan, planTotals, prettyDate, projectedLimits, WEEKDAY_LONG, WEEKDAY_SHORT, parseISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Weekday } from '@/domain/types';
import { DateTile, LinkText, ListCard, Row, SectionLabel } from '@/features/core/components';
import { billsInCycle, editRoute, ordinal, shortDay, type OnboardingEditStep } from '@/features/core/helpers';
import { useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const TABS = ['Bills & EMIs', 'Income', 'Routine', 'Week', 'Savings'] as const;
type Tab = (typeof TABS)[number];

export default function PlanTab() {
  const [tab, setTab] = useState<Tab>('Bills & EMIs');
  return (
    <Screen scroll>
      <T v="h1" style={{ fontSize: 26, paddingTop: 12 }}>
        Plan
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
        <View style={{ width: 12 }} />
        {TABS.map((t) => (
          <Chip key={t} label={t} selected={t === tab} onPress={() => setTab(t)} />
        ))}
        <View style={{ width: 12 }} />
      </ScrollView>
      {tab === 'Bills & EMIs' ? <Bills /> : null}
      {tab === 'Income' ? <Income /> : null}
      {tab === 'Routine' ? <Routine /> : null}
      {tab === 'Week' ? <Week /> : null}
      {tab === 'Savings' ? <Savings /> : null}
    </Screen>
  );
}

function EditLink({ step, label = 'Edit' }: { step: OnboardingEditStep; label?: string }) {
  return <LinkText label={label} icon="edit" onPress={() => router.push(editRoute(step))} />;
}

function Empty({ text }: { text: string }) {
  return (
    <T v="small" color={C.inkMuted} style={{ paddingVertical: 14 }}>
      {text}
    </T>
  );
}

function usePlan() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const plan = useMemo(() => dayPlan(profile, entries), [profile, entries]);
  return { profile, entries, plan, cur: profile.currency };
}

function Bills() {
  const { profile, plan, cur } = usePlan();
  const bills = useMemo(() => billsInCycle(profile, plan), [profile, plan]);
  const payday = addDays(plan.cycle.end, 1);
  const hasAny = profile.bills.length + profile.emis.length > 0;
  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
            {`Still to pay before ${shortDay(payday)}`}
          </T>
          <T v="h2" style={{ fontSize: 24 }}>
            {fmt(bills.totalUpcoming, cur)}
          </T>
        </View>
        {hasAny ? <Pill label="Fully set aside" bg={C.okSoft} fg={C.ok} /> : null}
      </Card>

      <SectionLabel>COMING UP</SectionLabel>
      <ListCard>
        {bills.upcoming.length ? (
          bills.upcoming.map((b, i) => (
            <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: i === bills.upcoming.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
              <DateTile date={b.date} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodySemi">{b.name}</T>
                <T v="caption" color={C.inkMuted}>
                  {b.kind === 'emi' ? `EMI${b.monthsLeft ? ` · ${b.monthsLeft} months left` : ''}` : `Monthly · due on the ${ordinal(parseISODate(b.date).getDate())}`}
                </T>
              </View>
              <T v="h3" style={{ fontFamily: F.display, fontSize: 16 }}>
                {fmt(b.amount, cur)}
              </T>
            </View>
          ))
        ) : (
          <Empty text={hasAny ? 'Nothing else due before payday.' : 'No bills or EMIs yet. Add rent, utilities or loans and Pace keeps them out of your daily limit.'} />
        )}
      </ListCard>

      {bills.passed.length ? (
        <>
          <SectionLabel>PAID THIS CYCLE</SectionLabel>
          <ListCard>
            {bills.passed.map((b, i) => (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: i === bills.passed.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.okSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={20} color={C.ok} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodySemi">{b.name}</T>
                  <T v="caption" color={C.inkMuted}>
                    {`Paid ${shortDay(b.date)}${b.kind === 'emi' && b.monthsLeft ? ` · ${b.monthsLeft} months left` : ''}`}
                  </T>
                </View>
                <T v="h3" color={C.inkMuted} style={{ fontFamily: F.display, fontSize: 16 }}>
                  {fmt(b.amount, cur)}
                </T>
              </View>
            ))}
          </ListCard>
        </>
      ) : null}

      <View style={{ gap: 4 }}>
        <LinkText label="Add or edit bills and subscriptions" icon="plus" onPress={() => router.push(editRoute('bills'))} />
        <LinkText label="Add or edit EMIs" icon="plus" onPress={() => router.push(editRoute('emi'))} />
      </View>
    </>
  );
}

function Income() {
  const { profile, cur } = usePlan();
  const t = planTotals(profile);
  return (
    <>
      <SectionLabel right={<EditLink step="income" />}>INCOME</SectionLabel>
      <ListCard>
        {profile.incomes.length ? (
          profile.incomes.map((x, i) => (
            <Row key={x.id} label={x.name || 'Income'} sub={`Arrives on the ${ordinal(x.dueDay)}`} value={fmt(x.amount, cur)} last={i === profile.incomes.length - 1} />
          ))
        ) : (
          <Empty text="No income added yet." />
        )}
      </ListCard>
      {profile.irregularIncome ? (
        <T v="caption" color={C.inkMuted}>
          Your income varies month to month. Pace plans on the amount above.
        </T>
      ) : null}

      <SectionLabel right={<EditLink step="pay" />}>BUDGET CYCLE</SectionLabel>
      <ListCard>
        <Row label="Payday" sub="Your cycle runs from payday to the day before the next one" value={`${ordinal(profile.payday)} of the month`} last />
      </ListCard>

      <SectionLabel>HOW YOUR MONTH ADDS UP</SectionLabel>
      <ListCard>
        <Row label="Income" value={fmt(t.income, cur)} />
        <Row label="Bills" value={fmt(-t.bills, cur)} />
        <Row label="EMIs" value={fmt(-t.emis, cur)} />
        <Row label="Routine" value={fmt(-t.routine, cur)} />
        <Row label="Savings" value={fmt(-t.savings, cur)} />
        <Row label="Free to spend" value={fmt(t.flexible, cur)} strong last />
      </ListCard>
      {profile.start ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="caption" color={C.inkMuted} style={{ flex: 1 }}>
            {`Starting point: ${fmt(profile.start.flexibleLeft, cur)} left on ${prettyDate(profile.start.date)}`}
          </T>
          <EditLink step="start" />
        </View>
      ) : (
        <EditLink step="start" label="Set where you stand today" />
      )}
    </>
  );
}

function Routine() {
  const { profile, cur } = usePlan();
  return (
    <>
      <Card style={{ gap: 2 }}>
        <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
          Routine every month
        </T>
        <T v="h2" style={{ fontSize: 24 }}>
          {fmt(profile.routineMonthly, cur)}
        </T>
        <T v="caption" color={C.inkMuted}>
          Groceries, fuel, help at home: kept out of your daily limit.
        </T>
      </Card>
      <SectionLabel right={<EditLink step="routine" />}>ITEMS</SectionLabel>
      <ListCard>
        {profile.routineItems.length ? (
          profile.routineItems.map((x, i) => <Row key={x.id} label={x.name} value={fmt(x.amount, cur)} last={i === profile.routineItems.length - 1} />)
        ) : (
          <Empty text="No routine costs added yet." />
        )}
      </ListCard>
    </>
  );
}

function Week() {
  const { profile, entries, plan, cur } = usePlan();
  const strip = useMemo(() => projectedLimits(profile, entries, plan.date, 7), [profile, entries, plan.date]);
  const days: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  return (
    <>
      <SectionLabel right={<EditLink step="week" />}>WEEKLY PATTERN</SectionLabel>
      <Card>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {days.map((d) => {
            const work = profile.workDays.includes(d);
            return (
              <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: work ? C.paper : C.mintSoft }}>
                <T v="caption" style={{ fontFamily: F.bodySemi }}>
                  {WEEKDAY_SHORT[d]}
                </T>
              </View>
            );
          })}
        </View>
        <T v="caption" color={C.inkMuted}>
          {`Green days are weekend days and get ${profile.weekendWeight || 1.6}× an office day.`}
        </T>
      </Card>

      <SectionLabel right={<EditLink step="week" />}>DAY EXTRAS</SectionLabel>
      <ListCard>
        {profile.dayExtras.length ? (
          profile.dayExtras.map((x, i) => (
            <Row key={x.id} label={x.label || 'Extra'} sub={`Every ${WEEKDAY_LONG[x.weekday]}`} value={`+${fmt(x.amount, cur)}`} last={i === profile.dayExtras.length - 1} />
          ))
        ) : (
          <Empty text="No day extras. Add one for a regular plan like Wednesday badminton." />
        )}
      </ListCard>

      <SectionLabel>NEXT 7 DAYS</SectionLabel>
      <ListCard>
        {strip.map((d, i) => (
          <Row
            key={d.date}
            label={i === 0 ? `Today · ${prettyDate(d.date)}` : prettyDate(d.date)}
            sub={d.work ? (d.extra ? 'Office day + extra' : 'Office day') : d.extra ? 'Weekend day + extra' : 'Weekend day'}
            value={fmt(d.limit, cur)}
            last={i === strip.length - 1}
          />
        ))}
      </ListCard>
    </>
  );
}

function Savings() {
  const { profile, cur } = usePlan();
  return (
    <>
      <Card style={{ gap: 2 }}>
        <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
          Saving every month
        </T>
        <T v="h2" style={{ fontSize: 24 }}>
          {fmt(profile.savingsMonthly, cur)}
        </T>
        <T v="caption" color={C.inkMuted}>
          {profile.savingsMonthly > 0
            ? `That is ${fmt(profile.savingsMonthly * 12, cur)} a year, set aside before your daily limit.`
            : 'Nothing set aside yet. Even a small amount each month adds up.'}
        </T>
      </Card>
      <EditLink step="savings" label="Change savings" />
    </>
  );
}
