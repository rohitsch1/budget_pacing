import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, Icon, T } from '@/components/ui';
import { MONTH_SHORT, WEEKDAY_LONG, WEEKDAY_SHORT, parseISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { DayExtra, Weekday } from '@/domain/types';
import { updateDraft, useDraft } from '@/features/onboarding/draft';
import { AmountInput, Bubble, ObScaffold, Question, Reply, SkipLink, TextField, WeekdayToggles, useObFlow } from '@/features/onboarding/kit';
import { WEEK_ORDER, cycleInfo, defaultUsual, typical } from '@/features/onboarding/logic';
import { actions, newId, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const IDEAS: { label: string; day: Weekday; inr: number }[] = [
  { label: 'Badminton', day: 3, inr: 200 },
  { label: 'Dinner with team', day: 5, inr: 300 },
  { label: 'Sunday market', day: 0, inr: 400 },
];

export default function Week() {
  const profile = useStore((s) => s.profile);
  const draft = useDraft();
  const flow = useObFlow('/onboarding/savings');
  const cur = profile.currency;
  const def = defaultUsual(profile.region);
  const work = draft.usualWorkDay ?? def.work;
  const off = draft.usualDayOff ?? Math.round(work * (profile.weekendWeight || 1.6));

  const [adding, setAdding] = useState(false);
  const [xDay, setXDay] = useState<Weekday>(3);
  const [xLabel, setXLabel] = useState('');
  const [xAmt, setXAmt] = useState<number | null>(null);

  const setUsual = (w: number | null, o: number | null) => {
    updateDraft({ usualWorkDay: w, usualDayOff: o });
    if (w && o) {
      const ratio = Math.round(Math.min(3, Math.max(0.5, o / w)) * 10) / 10;
      actions.updateProfile({ weekendWeight: ratio });
    }
  };

  const addExtra = () => {
    if (!xAmt) return;
    const x: DayExtra = { id: newId('dx'), weekday: xDay, amount: xAmt, label: xLabel.trim() || 'Extra' };
    actions.updateProfile({ dayExtras: [...profile.dayExtras, x] });
    setAdding(false);
    setXLabel('');
    setXAmt(null);
  };
  const removeExtra = (id: string) => actions.updateProfile({ dayExtras: profile.dayExtras.filter((x) => x.id !== id) });

  const info = cycleInfo(profile);
  const extrasTotal = profile.dayExtras.reduce((a, x) => a + x.amount * info.perWeekday[x.weekday], 0);
  const total = info.work * work + info.off * off + extrasTotal;
  const s = parseISODate(info.cycle.start);
  const e = parseISODate(info.cycle.end);
  const range = `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTH_SHORT[e.getMonth()]}`;

  return (
    <ObScaffold
      chapter="MONEY OUT"
      right={flow.isEdit ? null : <SkipLink onPress={flow.skip} />}
      footer={
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: C.harbor }}>
            <T v="caption" color={C.onDarkMuted} style={{ flex: 1, lineHeight: 17 }}>
              {`${range}: ${info.work} work days, ${info.off} days off\n${extrasTotal ? `+ ${fmt(extrasTotal, cur)} in day extras` : 'No day extras'}`}
            </T>
            <T color={C.mint} style={{ fontFamily: F.display, fontSize: 22 }}>
              {fmt(total, cur)}
            </T>
          </View>
          <Button
            label={flow.label('Continue')}
            onPress={() => {
              setUsual(work, off);
              flow.go();
            }}
          />
        </>
      }>
      <Bubble>Let&apos;s map your week. First, which days do you go to work? Tap to change.</Bubble>
      <WeekdayToggles value={profile.workDays} onChange={(v) => actions.updateProfile({ workDays: v })} />

      <Bubble delay={250}>And what does a normal day usually cost you? Think meals, snacks, coffee, getting around. Not bills or the routine stuff.</Bubble>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <T v="bodySemi" style={{ fontSize: 14 }}>
            Work day
          </T>
          <AmountInput label="A usual work day" value={work} onChange={(v) => setUsual(v, off)} currency={cur} />
          <T v="caption" color={C.inkMuted}>
            Breakfast, lunch, commute, coffee
          </T>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <T v="bodySemi" style={{ fontSize: 14 }}>
            Day off
          </T>
          <AmountInput label="A usual day off" value={off} onChange={(v) => setUsual(work, v)} currency={cur} />
          <T v="caption" color={C.inkMuted}>
            Meals out, going out, errands
          </T>
        </View>
      </View>
      {work > 0 && off > 0 ? (
        <Reply k={String(profile.weekendWeight)}>
          {`So a day off gets about ${profile.weekendWeight.toFixed(1)}× a work day. I'll shape your daily number the same way.`}
        </Reply>
      ) : null}

      <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, gap: 10 }}>
        <View style={{ gap: 2 }}>
          <Question>Extra on certain days?</Question>
          <T v="caption" color={C.inkMuted}>
            Badminton on Wednesdays, a Friday dinner, Sunday market…
          </T>
        </View>

        {profile.dayExtras.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: C.link, backgroundColor: '#E6F6EE' }}>
            <View style={{ width: 42, height: 32, borderRadius: 8, backgroundColor: C.harbor, alignItems: 'center', justifyContent: 'center' }}>
              <T color={C.mint} style={{ fontFamily: F.bodyBold, fontSize: 12 }}>
                {WEEKDAY_SHORT[x.weekday].toUpperCase()}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodySemi" style={{ fontSize: 13 }}>
                {x.label}
              </T>
              <T v="caption" color={C.inkMuted} style={{ fontSize: 11 }}>
                {`Every ${WEEKDAY_LONG[x.weekday]} · ${info.perWeekday[x.weekday]} this cycle`}
              </T>
            </View>
            <T style={{ fontFamily: F.display, fontSize: 15 }}>{fmt(x.amount, cur, { sign: true })}</T>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${x.label}`} hitSlop={8} onPress={() => removeExtra(x.id)} style={{ padding: 4 }}>
              <Icon name="close" size={16} color={C.inkMuted} />
            </Pressable>
          </View>
        ))}

        {adding ? (
          <View style={{ gap: 10, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {WEEK_ORDER.map((d) => (
                <Chip key={d} label={WEEKDAY_SHORT[d]} selected={xDay === d} onPress={() => setXDay(d)} style={{ paddingHorizontal: 10, height: 34 }} />
              ))}
            </View>
            <TextField label="What is it?" value={xLabel} onChange={setXLabel} placeholder="e.g. Badminton" />
            <AmountInput label="Extra amount" value={xAmt} onChange={setXAmt} currency={cur} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small kind="secondary" label="Cancel" onPress={() => setAdding(false)} style={{ flex: 1 }} />
              <Button small label={`Add to ${WEEKDAY_SHORT[xDay]}`} disabled={!xAmt} onPress={addExtra} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {IDEAS.filter((i) => !profile.dayExtras.some((x) => x.label === i.label)).map((i) => (
                <Chip
                  key={i.label}
                  label={`${i.label} · ${WEEKDAY_SHORT[i.day]}`}
                  onPress={() => {
                    setXDay(i.day);
                    setXLabel(i.label);
                    setXAmt(typical(i.inr, profile.region));
                    setAdding(true);
                  }}
                />
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)} hitSlop={6} style={{ paddingVertical: 4 }}>
              <T v="bodySemi" color={C.link} style={{ fontSize: 13 }}>
                + Add an extra for a day
              </T>
            </Pressable>
          </View>
        )}
      </View>
    </ObScaffold>
  );
}
