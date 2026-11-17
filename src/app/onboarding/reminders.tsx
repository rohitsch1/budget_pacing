import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, T } from '@/components/ui';
import { requestReminderPermission, scheduleReminders } from '@/features/reminders';
import { Bubble, ObScaffold, Toggle, useObFlow } from '@/features/onboarding/kit';
import { actions, getState, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const MORNING = ['07:30', '08:00', '08:30', '09:00', '09:30'];
const EVENING = ['20:00', '21:00', '21:30', '22:00', '22:30'];

function pretty(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}
function nextOf(list: string[], cur: string) {
  const i = list.indexOf(cur);
  return list[(i + 1) % list.length];
}

export default function Reminders() {
  const r = useStore((s) => s.profile.reminders);
  const flow = useObFlow('/onboarding/done');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof r>) => actions.updateProfile({ reminders: { ...r, ...p } });

  const rows = [
    { key: 'morning' as const, n: 'Your number each morning', s: `${pretty(r.morningAt)} · “Today you can spend…”`, at: r.morningAt, cycle: () => set({ morningAt: nextOf(MORNING, r.morningAt) }) },
    { key: 'evening' as const, n: 'End-of-day check-in', s: `${pretty(r.eveningAt)} · “Log today's spends in 5 seconds”`, at: r.eveningAt, cycle: () => set({ eveningAt: nextOf(EVENING, r.eveningAt) }) },
  ];

  const nothingOn = !r.morning && !r.evening;
  const allow = async () => {
    setBusy(true);
    try {
      const ok = nothingOn || (await requestReminderPermission());
      if (ok) await scheduleReminders(getState().profile);
    } catch {
      // permission UI failed; carry on, reminders can be enabled from Settings
    } finally {
      setBusy(false);
    }
    flow.go();
  };

  return (
    <ObScaffold
      footer={
        <>
          <Button label={flow.isEdit ? 'Save' : nothingOn ? 'Continue' : 'Allow notifications'} loading={busy} onPress={nothingOn && !flow.isEdit ? () => router.push('/onboarding/done') : allow} />
          {!flow.isEdit && !nothingOn ? <Button kind="ghost" small label="Not now" onPress={() => router.push('/onboarding/done')} /> : null}
        </>
      }>
      <Bubble>Your number is only as good as what you log. Most people forget lunch. Want a gentle nudge? Pick what helps; I&apos;ll stay quiet otherwise.</Bubble>

      <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 2 }}>
        {rows.map((row, i) => (
          <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="bodySemi">{row.n}</T>
              <T v="caption" color={C.inkMuted}>
                {row.s}
              </T>
              {r[row.key] ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Change time, now ${pretty(row.at)}`} onPress={row.cycle} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
                  <T v="caption" color={C.link} style={{ fontFamily: F.bodySemi }}>
                    Change time
                  </T>
                </Pressable>
              ) : null}
            </View>
            <Toggle label={row.n} on={r[row.key]} onChange={(v) => set({ [row.key]: v })} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.lineSoft }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="bodySemi">Quiet on weekends</T>
            <T v="caption" color={C.inkMuted}>
              No nudges on your days off
            </T>
          </View>
          <Toggle label="Quiet on weekends" on={r.quietWeekends} onChange={(v) => set({ quietWeekends: v })} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: C.linkSoft }}>
        <Icon name="bell" size={18} color={C.link} />
        <T v="small" style={{ flex: 1 }}>
          Just two short nudges a day at most. Turn them off any time in Settings.
        </T>
      </View>
    </ObScaffold>
  );
}
