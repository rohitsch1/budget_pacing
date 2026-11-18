import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card, Chip, Screen, T } from '@/components/ui';
import { dayPlan, parseISODate, todayISO } from '@/domain/budget';
import { fmt } from '@/domain/money';
import { chartColor, cycleLabel, cyclesWithEntries } from '@/features/core/helpers';
import { buildInsights, type Insight } from '@/features/core/insights';
import { useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

export default function Insights() {
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const today = todayISO();
  const cycles = useMemo(() => cyclesWithEntries(profile, entries, today), [profile, entries, today]);
  const [pick, setPick] = useState(0);
  const sel = Math.min(pick, cycles.length - 1);
  const cycle = cycles[sel];
  const refDate = sel === 0 ? today : cycle.end;
  const plan = useMemo(() => dayPlan(profile, entries, refDate), [profile, entries, refDate]);
  const data = useMemo(() => buildInsights(profile, entries, plan, today), [profile, entries, plan, today]);
  const cur = profile.currency;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
        <T v="h1" style={{ fontSize: 26 }}>
          Insights
        </T>
        {cycles.length === 1 ? (
          <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: C.white, borderWidth: 1, borderColor: C.chipLine }}>
            <T v="small" style={{ fontFamily: F.bodySemi }}>
              {`This cycle · ${cycleLabel(cycle)}`}
            </T>
          </View>
        ) : null}
      </View>

      {cycles.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
          <View style={{ width: 12 }} />
          {cycles.map((c, i) => (
            <Chip
              key={c.start}
              label={i === 0 ? 'This cycle' : cycleLabel(c)}
              selected={i === sel}
              onPress={() => setPick(i)}
            />
          ))}
          <View style={{ width: 12 }} />
        </ScrollView>
      ) : null}

      {!data.hasData ? (
        <Card>
          <T v="bodySemi">Nothing to show yet</T>
          <T v="small" color={C.inkMuted}>
            Insights appear once you have logged a few spends this cycle. Tap + to add one.
          </T>
        </Card>
      ) : (
        <>
          {data.cards.map((c, i) => (
            <InsightCard key={`${cycle.start}-${c.id}`} insight={c} dark={i === 0} index={i} />
          ))}

          {data.weeks.length > 1 ? <WeekChart weeks={data.weeks} cur={cur} /> : null}
          <DailyChart daily={data.daily} cur={cur} />
          <CategoryChart data={data} cur={cur} />
        </>
      )}
    </Screen>
  );
}

function InsightCard({ insight, dark, index }: { insight: Insight; dark: boolean; index: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
      <Card dark={dark} style={{ gap: 6 }}>
        <T v="label" color={dark ? C.mint : C.link} style={{ letterSpacing: 0.6, fontFamily: F.bodySemi }}>
          {insight.kicker}
        </T>
        <T v="bodySemi" color={dark ? C.onDark : C.ink} style={{ fontSize: 16, lineHeight: 22 }}>
          {insight.title}
        </T>
        {insight.body ? (
          <T v="small" color={dark ? C.onDarkMuted : C.inkMuted} style={{ lineHeight: 19 }}>
            {insight.body}
          </T>
        ) : null}
      </Card>
    </Animated.View>
  );
}

type Cur = Parameters<typeof fmt>[1];

function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: it.line ? 2 : 10, borderRadius: it.line ? 0 : 3, backgroundColor: it.color }} />
          <T v="caption" color={C.inkMuted} style={{ fontSize: 11 }}>
            {it.label}
          </T>
        </View>
      ))}
    </View>
  );
}

function WeekChart({ weeks, cur }: { weeks: ReturnType<typeof buildInsights>['weeks']; cur: Cur }) {
  const H = 100;
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.spent, w.plan)));
  const label = weeks.map((w) => `${w.label}: ${w.state === 'future' ? `not started, ${fmt(w.plan, cur)} planned` : `${fmt(w.spent, cur)} of ${fmt(w.plan, cur)} planned`}`).join('; ');
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="bodySemi">Week by week</T>
        <Legend items={[{ label: 'Spent', color: C.harbor }, { label: 'Plan', color: C.link, line: true }]} />
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={`Spending per week against plan. ${label}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18, height: H + 20, paddingHorizontal: 6 }}>
        {weeks.map((w) => (
          <View key={w.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <T v="caption" color={w.state === 'future' ? C.inkMuted : C.ink} style={{ fontSize: 11, fontFamily: F.bodySemi }}>
              {w.state === 'future' ? '—' : fmt(w.spent, cur)}
            </T>
            <View style={{ width: '100%', height: H, justifyContent: 'flex-end' }}>
              {w.state === 'future' ? (
                <View style={{ width: '100%', height: 2, backgroundColor: C.line }} />
              ) : (
                <View
                  style={{
                    width: '100%',
                    height: Math.max(4, (Math.max(0, w.spent) / max) * H),
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    borderBottomLeftRadius: 4,
                    borderBottomRightRadius: 4,
                    backgroundColor: w.state === 'current' ? '#9FB3B7' : C.harbor,
                  }}
                />
              )}
              {w.plan > 0 ? (
                <View style={{ position: 'absolute', left: -4, right: -4, bottom: (w.plan / max) * H, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.link }} />
              ) : null}
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 18, paddingHorizontal: 6 }}>
        {weeks.map((w) => (
          <T key={w.label} v="caption" color={C.inkMuted} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {w.label}
          </T>
        ))}
      </View>
    </Card>
  );
}

function DailyChart({ daily, cur }: { daily: ReturnType<typeof buildInsights>['daily']; cur: Cur }) {
  if (!daily.length) return null;
  const H = 90;
  const max = Math.max(1, ...daily.map((d) => Math.max(d.spent, d.limit)));
  const overDays = daily.filter((d) => d.spent > d.limit).length;
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="bodySemi">Daily spend vs limit</T>
        <Legend items={[{ label: 'Within', color: C.mint }, { label: 'Over', color: C.coral }, { label: 'Limit', color: C.harbor, line: true }]} />
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Last ${daily.length} days: over the limit on ${overDays} ${overDays === 1 ? 'day' : 'days'}`}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: H }}>
        {daily.map((d) => (
          <View key={d.date} style={{ flex: 1, height: H, justifyContent: 'flex-end' }}>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: (d.limit / max) * H, height: 2, backgroundColor: C.harbor }} />
            <View
              style={{
                height: Math.max(2, (d.spent / max) * H),
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                backgroundColor: d.spent > d.limit ? C.coral : C.mint,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {daily.map((d, i) => (
          <T key={d.date} v="caption" color={C.inkMuted} style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
            {i % 2 === (daily.length - 1) % 2 ? parseISODate(d.date).getDate() : ''}
          </T>
        ))}
      </View>
    </Card>
  );
}

function CategoryChart({ data, cur }: { data: ReturnType<typeof buildInsights>; cur: Cur }) {
  const { categories, netTotal, unlinkedRefunds, outsideLimit, outsideCount } = data;
  if (!categories.length && !outsideLimit) return null;
  return (
    <Card style={{ gap: 10 }}>
      {categories.length ? (
        <>
          <T v="bodySemi">{`Where it went · ${fmt(netTotal, cur)}`}</T>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Category split: ${categories.map((c) => `${c.name} ${Math.round(c.pct * 100)}%`).join(', ')}`}
            style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
            {categories.map((c) => (
              <View key={c.name} style={{ flex: Math.max(0.01, c.pct), backgroundColor: chartColor(c.name) }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6, columnGap: 14 }}>
            {categories.map((c) => (
              <View key={c.name} style={{ width: '46%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: chartColor(c.name) }} />
                <T v="small" style={{ flex: 1 }} numberOfLines={1}>
                  {c.name}
                </T>
                <T v="small" style={{ fontFamily: F.bodyBold }}>
                  {`${Math.round(c.pct * 100)}%`}
                </T>
              </View>
            ))}
          </View>
          <T v="caption" color={C.inkMuted}>
            {`Refunds are taken off the spend they belong to.${unlinkedRefunds > 0 ? ` ${fmt(unlinkedRefunds, cur)} in other refunds is taken off the total.` : ''}`}
          </T>
        </>
      ) : null}
      {outsideLimit > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTopWidth: categories.length ? 1 : 0, borderTopColor: C.lineSoft, paddingTop: categories.length ? 10 : 0 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="small" style={{ fontFamily: F.bodySemi }}>
              Bills & EMIs paid
            </T>
            <T v="caption" color={C.inkMuted}>
              {`${outsideCount} ${outsideCount === 1 ? 'payment' : 'payments'} outside your daily limit`}
            </T>
          </View>
          <T v="small" style={{ fontFamily: F.bodyBold }}>
            {fmt(outsideLimit, cur)}
          </T>
        </View>
      ) : null}
    </Card>
  );
}
