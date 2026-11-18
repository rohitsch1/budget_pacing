import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Icon, T } from '@/components/ui';
import { requestReminderPermission, scheduleReminders } from '@/features/reminders';
import { Bubble, ObScaffold, Toggle, useObFlow } from '@/features/onboarding/kit';
import { TimeChanger, prettyTime as pretty } from '@/features/onboarding/time';
import { actions, getState, useStore } from '@/store';
import { C } from '@/theme/tokens';

export default function Reminders() {
  const r = useStore((s) => s.profile.reminders);
  const flow = useObFlow('/onboarding/done');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof r>) => actions.updateProfile({ reminders: { ...r, ...p } });

  const rows = [
    { key: 'morning' as const, n: 'Your number each morning', s: `${pretty(r.morningAt)} · “Today you can spend…”`, at: r.morningAt, setAt: (v: string) => set({ morningAt: v }) },
    { key: 'evening' as const, n: 'End-of-day check-in', s: `${pretty(r.eveningAt)} · “Log today's spends in 5 seconds”`, at: r.eveningAt, setAt: (v: string) => set({ eveningAt: v }) },
  ];

  const nothingOn = !r.morning && !r.evening;
  /** Nothing will be scheduled, so don't show reminders as ON anywhere. */
  const turnOff = () => actions.updateProfile({ reminders: { ...getState().profile.reminders, morning: false, evening: false } });
  const notNow = () => {
    turnOff();
    router.push('/onboarding/done');
  };
  const allow = async () => {
    setBusy(true);
    let denied = false;
    try {
      const ok = nothingOn || (await requestReminderPermission());
      if (ok) await scheduleReminders(getState().profile);
      else {
        denied = true;
        turnOff();
      }
    } catch {
      denied = !nothingOn;
      if (denied) turnOff();
    } finally {
      setBusy(false);
    }
    if (denied && flow.isEdit) {
      Alert.alert('Notifications are off', 'Allow notifications for Pace in your phone settings, then turn reminders on again.');
    }
    flow.go();
  };

  return (
    <ObScaffold
      footer={
        <>
          <Button label={flow.isEdit ? 'Save' : nothingOn ? 'Continue' : 'Allow notifications'} loading={busy} onPress={nothingOn && !flow.isEdit ? () => router.push('/onboarding/done') : allow} />
          {!flow.isEdit && !nothingOn ? <Button kind="ghost" small label="Not now" onPress={notNow} /> : null}
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
              {r[row.key] ? <TimeChanger value={row.at} onChange={row.setAt} label={row.n} /> : null}
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
