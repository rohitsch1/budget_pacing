import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Bar, Card, Chip, Icon, Pill, Screen, T } from '@/components/ui';
import {
  addDays,
  cycleFlexible,
  dayPlan,
  emiMonthsLeft,
  goalMonthly,
  parseISODate,
  planTotals,
  prettyDate,
  projectedLimits,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
} from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Debt, Weekday } from '@/domain/types';
import { DateTile, LinkText, ListCard, Row, SectionLabel } from '@/features/core/components';
import { billsInCycle, editRoute, ordinal, shortDay, type DueItem, type OnboardingEditStep } from '@/features/core/helpers';
import { frequencyLabel, paydaySummary } from '@/features/onboarding/logic';
import { actions, getState, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const TABS = ['Bills & EMIs', 'Income', 'Routine', 'Week', 'Savings & goals', 'Money owed'] as const;
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
      {tab === 'Savings & goals' ? <SavingsGoals /> : null}
      {tab === 'Money owed' ? <MoneyOwed /> : null}
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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Bills() {
  const { profile, plan, cur } = usePlan();
  const t = planTotals(profile, plan.date);
  const { upcoming, passed, paidOff, totalUpcoming } = useMemo(() => {
    const raw = billsInCycle(profile, plan);
    const emiById = new Map(profile.emis.map((e) => [e.id, e]));
    // An EMI instalment after its last due date isn't owed any more.
    const owed = (b: DueItem) => {
      if (b.kind !== 'emi') return true;
      const e = emiById.get(b.id);
      return !e?.endDate || b.date <= e.endDate;
    };
    const up = raw.upcoming.filter(owed);
    const past = raw.passed.filter(owed);
    const listed = new Set([...up, ...past].map((b) => b.id));
    const done = profile.emis.filter((e) => emiMonthsLeft(e, plan.date) === 0 && !listed.has(e.id));
    return { upcoming: up, passed: past, paidOff: done, totalUpcoming: up.reduce((a, b) => a + b.amount, 0) };
  }, [profile, plan]);

  const emiSub = (b: DueItem, paid: boolean) => {
    const e = profile.emis.find((x) => x.id === b.id);
    const left = e ? emiMonthsLeft(e, plan.date) : null;
    const last = e?.endDate && b.date >= e.endDate.slice(0, 10);
    const tail = last ? ' · last instalment' : left ? ` · ${plural(left, 'month')} left` : '';
    return paid ? `Paid ${shortDay(b.date)}${tail}` : `EMI${tail}`;
  };

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
            {fmt(totalUpcoming, cur)}
          </T>
        </View>
        {hasAny ? (
          t.flexible >= 0 ? (
            <Pill label="Fully set aside" bg={C.okSoft} fg={C.ok} />
          ) : (
            <Pill label={`Short by ${fmt(-t.flexible, cur)}`} bg={C.coralSoft} fg={C.coralInk} />
          )
        ) : null}
      </Card>
      {hasAny && t.flexible < 0 ? (
        <T v="caption" color={C.coralInk}>
          Your plan spends more than comes in each month. Trim a bill, savings or a goal so everything can be set aside.
        </T>
      ) : null}

      <SectionLabel>COMING UP</SectionLabel>
      <ListCard>
        {upcoming.length ? (
          upcoming.map((b, i) => (
            <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, borderBottomWidth: i === upcoming.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
              <DateTile date={b.date} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodySemi">{b.name}</T>
                <T v="caption" color={C.inkMuted}>
                  {b.kind === 'emi' ? emiSub(b, false) : `Monthly · due on the ${ordinal(parseISODate(b.date).getDate())}`}
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

      {passed.length ? (
        <>
          <SectionLabel>PAID THIS CYCLE</SectionLabel>
          <ListCard>
            {passed.map((b, i) => (
              <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: i === passed.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.okSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={20} color={C.ok} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodySemi">{b.name}</T>
                  <T v="caption" color={C.inkMuted}>
                    {b.kind === 'emi' ? emiSub(b, true) : `Paid ${shortDay(b.date)}`}
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

      {paidOff.length ? (
        <>
          <SectionLabel>PAID OFF</SectionLabel>
          <ListCard>
            {paidOff.map((e, i) => (
              <Row
                key={e.id}
                label={e.name || 'Loan'}
                sub={e.endDate ? `Last instalment ${prettyDate(e.endDate)} · no longer counted` : 'No longer counted'}
                right={<Pill label="Paid off" bg={C.okSoft} fg={C.ok} />}
                last={i === paidOff.length - 1}
              />
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
  const { profile, plan, cur } = usePlan();
  const t = planTotals(profile, plan.date);
  const monthly = (profile.payFrequency ?? 'monthly') === 'monthly';
  const perCycle = cycleFlexible(profile, plan.cycle, plan.date);
  return (
    <>
      <SectionLabel right={<EditLink step="income" />}>INCOME PER MONTH</SectionLabel>
      <ListCard>
        {profile.incomes.length ? (
          profile.incomes.map((x, i) => (
            <Row
              key={x.id}
              label={x.name || 'Income'}
              sub={monthly ? `Arrives on the ${ordinal(x.dueDay)}` : `Per month · paid ${frequencyLabel(profile).toLowerCase()}`}
              value={fmt(x.amount, cur)}
              last={i === profile.incomes.length - 1}
            />
          ))
        ) : (
          <Empty text="No income added yet." />
        )}
      </ListCard>
      {t.irregularBuffer > 0 ? (
        <T v="caption" color={C.inkMuted}>
          {`Your income varies, so Pace plans on ${fmt(t.income, cur)} and keeps ${fmt(t.irregularBuffer, cur)} as a buffer for slower months.`}
        </T>
      ) : null}

      <SectionLabel right={<EditLink step="pay" />}>BUDGET CYCLE</SectionLabel>
      <ListCard>
        <Row label="Payday" sub={paydaySummary(profile, plan.date)} value={monthly ? `${ordinal(profile.payday)} of the month` : undefined} last />
      </ListCard>

      <SectionLabel>HOW YOUR MONTH ADDS UP</SectionLabel>
      <ListCard>
        <Row label="Income" value={fmt(t.incomeEntered, cur)} />
        {t.irregularBuffer > 0 ? <Row label="Buffer for a slower month" value={fmt(-t.irregularBuffer, cur)} /> : null}
        <Row label="Bills" value={fmt(-t.bills, cur)} />
        <Row label="EMIs" value={fmt(-t.emis, cur)} />
        <Row label="Routine" value={fmt(-t.routine, cur)} />
        <Row label="Savings" value={fmt(-t.savings, cur)} />
        {t.goals > 0 ? <Row label="Goals" value={fmt(-t.goals, cur)} /> : null}
        <Row label="Free to spend" value={fmt(t.flexible, cur)} strong last />
      </ListCard>
      {!monthly ? (
        <T v="caption" color={C.inkMuted}>
          {`You're paid ${frequencyLabel(profile).toLowerCase()}, so each ${plan.cycle.days}-day cycle gets about ${fmt(perCycle, cur)} of this to spend.`}
        </T>
      ) : null}
      {profile.start && !profile.start.auto ? (
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

function SavingsGoals() {
  const { profile, plan, cur } = usePlan();
  const goals = profile.goals ?? [];
  const goalsMonthly = goals.reduce((a, g) => a + goalMonthly(g, plan.date), 0);
  const saved = profile.savedSoFar ?? 0;
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
        {saved > 0 ? (
          <T v="caption" color={C.inkMuted}>
            {`Saved so far: ${fmt(saved, cur)}`}
          </T>
        ) : null}
      </Card>
      <EditLink step="savings" label="Change savings" />

      <SectionLabel right={<LinkText label={goals.length ? 'Manage' : 'Add'} icon={goals.length ? 'edit' : 'plus'} onPress={() => router.push('/goals')} />}>GOALS</SectionLabel>
      <Pressable accessibilityRole="button" accessibilityLabel="Open goals" onPress={() => router.push('/goals')}>
        <ListCard>
          <Row label="Set aside for goals" sub="Every month, kept out of your daily limit" value={fmt(goalsMonthly, cur)} strong last={!goals.length} />
          {goals.map((g, i) => {
            const per = goalMonthly(g, plan.date);
            return (
              <View key={g.id} style={{ paddingVertical: 10, gap: 6, borderBottomWidth: i === goals.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T v="small" style={{ fontSize: 14, fontFamily: F.bodySemi, flex: 1 }}>
                    {g.name}
                  </T>
                  <T v="caption" color={C.inkMuted}>
                    {per > 0 ? `${fmt(per, cur)}/month · by ${shortDay(g.targetDate)}` : 'Ready'}
                  </T>
                </View>
                <Bar value={g.amount > 0 ? g.saved / g.amount : 0} color={per > 0 ? C.mint : C.ok} height={6} />
                <T v="caption" color={C.inkMuted}>
                  {`${fmt(g.saved, cur)} of ${fmt(g.amount, cur)}`}
                </T>
              </View>
            );
          })}
        </ListCard>
      </Pressable>
      {!goals.length ? (
        <T v="caption" color={C.inkMuted}>
          Saving up for something? Add a goal and Pace sets aside a little each month so it&apos;s ready on time.
        </T>
      ) : null}
    </>
  );
}

function localNowISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function settle(d: Debt) {
  const { profile } = getState();
  const base = { amount: d.amount, currency: profile.currency, payee: d.label, source: 'manual' as const, at: localNowISO(), countsToBudget: true };
  if (d.dir === 'owe') actions.addEntry({ ...base, kind: 'expense', category: 'Other', note: `Paid back ${d.label}` });
  else actions.addEntry({ ...base, kind: 'payback', category: 'Income', note: `${d.label} paid me back` });
  actions.updateProfile({ debts: (getState().profile.debts ?? []).filter((x) => x.id !== d.id) });
}

function MoneyOwed() {
  const { profile, cur } = usePlan();
  const debts = profile.debts ?? [];
  const owe = debts.filter((d) => d.dir === 'owe');
  const owed = debts.filter((d) => d.dir === 'owed');
  const sum = (xs: Debt[]) => xs.reduce((a, d) => a + d.amount, 0);

  const confirm = (d: Debt) =>
    Alert.alert(
      d.dir === 'owe' ? `Paid ${d.label} back?` : `${d.label} paid you back?`,
      d.dir === 'owe'
        ? `${fmt(d.amount, cur)} will be added as a spend today and come out of your daily budget.`
        : `${fmt(d.amount, cur)} will be added back to your budget today.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settled', onPress: () => settle(d) },
      ],
    );

  const list = (xs: Debt[], title: string, color: string) =>
    xs.length ? (
      <>
        <SectionLabel>{title}</SectionLabel>
        <ListCard>
          {xs.map((d, i) => (
            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: i === xs.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodySemi">{d.label}</T>
                <T v="caption" color={color} style={{ fontFamily: F.bodySemi }}>
                  {fmt(d.amount, cur)}
                </T>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mark ${d.label} settled`}
                onPress={() => confirm(d)}
                style={({ pressed }) => ({ paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.btnLine, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <T v="small" style={{ fontFamily: F.bodySemi }}>
                  Settled
                </T>
              </Pressable>
            </View>
          ))}
        </ListCard>
      </>
    ) : null;

  return (
    <>
      <Card style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
            You owe
          </T>
          <T v="h2" color={owe.length ? C.coralInk : C.ink} style={{ fontSize: 22 }}>
            {fmt(sum(owe), cur)}
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
            Owed to you
          </T>
          <T v="h2" color={owed.length ? C.ok : C.ink} style={{ fontSize: 22 }}>
            {fmt(sum(owed), cur)}
          </T>
        </View>
      </Card>
      {list(owe, 'YOU OWE', C.coralInk)}
      {list(owed, 'OWED TO YOU', C.ok)}
      {!debts.length ? <Empty text="Nothing owed either way. Add money you owe or are owed and settle it here when it's paid." /> : null}
      <EditLink step="start" label={debts.length ? 'Add or remove' : 'Add money owed'} />
    </>
  );
}
