import { useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, Pill, T } from '@/components/ui';
import { dayPlan, entryDate, parseISODate, prettyDate, todayISO, addDays, WEEKDAY_SHORT, type ISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Entry } from '@/domain/types';
import { EntryRow, PendingBanner } from '@/features/core/components';
import { entryTitle } from '@/features/core/helpers';
import { useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

interface Section {
  date: ISODate;
  title: string;
  result: { label: string; over: boolean } | null;
  data: Entry[];
}

function matches(e: Entry, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [entryTitle(e), e.payee, e.note, e.category, e.app, e.method, String(e.amount)].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(s);
}

export default function Activity() {
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const [query, setQuery] = useState('');

  const sections = useMemo<Section[]>(() => {
    const today = todayISO();
    const yesterday = addDays(today, -1);
    const byDay = new Map<ISODate, Entry[]>();
    for (const e of entries) {
      if (!matches(e, query)) continue;
      const d = entryDate(e);
      const list = byDay.get(d);
      if (list) list.push(e);
      else byDay.set(d, [e]);
    }
    const hasPlan = profile.incomes.length > 0 || !!profile.start;
    return Array.from(byDay.keys())
      .sort((a, b) => (a < b ? 1 : -1))
      .map((d) => {
        const data = byDay.get(d)!.sort((a, b) => (a.at < b.at ? 1 : -1));
        const day = parseISODate(d);
        const short = `${WEEKDAY_SHORT[day.getDay()]} ${day.getDate()}`;
        const title = d === today ? `Today · ${short}` : d === yesterday ? `Yesterday · ${short}` : prettyDate(d);
        let result: Section['result'] = null;
        if (hasPlan && d <= today) {
          const p = dayPlan(profile, entries, d);
          result = p.left >= 0 ? { label: `${fmt(p.left, profile.currency)} left`, over: false } : { label: `${fmt(-p.left, profile.currency)} over`, over: true };
        }
        return { date: d, title, result, data };
      });
  }, [entries, profile, query]);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <T v="h1" style={{ fontSize: 26 }}>
              Activity
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
              <Icon name="search" size={20} color={C.inkMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search merchant, note, amount"
                placeholderTextColor={C.inkMuted}
                returnKeyType="search"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0 }}
              />
              {query ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery('')}>
                  <Icon name="close" size={18} color={C.inkMuted} />
                </Pressable>
              ) : null}
            </View>
            <PendingBanner />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 6, paddingHorizontal: 2 }}>
            <T v="small" style={{ fontFamily: F.bodyBold }}>
              {section.title}
            </T>
            {section.result ? (
              <Pill label={section.result.label} bg={section.result.over ? C.coralSoft : C.okSoft} fg={section.result.over ? C.coralInk : C.ok} />
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View
              style={{
                backgroundColor: C.white,
                borderColor: C.line,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopWidth: first ? 1 : 0,
                borderBottomWidth: last ? 1 : 0,
                borderTopLeftRadius: first ? R.md : 0,
                borderTopRightRadius: first ? R.md : 0,
                borderBottomLeftRadius: last ? R.md : 0,
                borderBottomRightRadius: last ? R.md : 0,
                paddingHorizontal: 14,
              }}>
              <EntryRow entry={item} withCategory={false} last={last} compact />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 40, alignItems: 'center', gap: 6 }}>
            <T v="bodySemi">{query ? 'Nothing matches that search' : 'No spends yet'}</T>
            <T v="small" color={C.inkMuted} style={{ textAlign: 'center' }}>
              {query ? 'Try a merchant name, a note or an amount.' : 'Tap + to add one, or share a payment screenshot to Pace.'}
            </T>
          </View>
        }
      />
    </View>
  );
}
