import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Switch, TextInput, View } from 'react-native';

import { Card, Header, Icon, Pill, Screen, T } from '@/components/ui';
import { prettyDate } from '@/domain/budget';
import { SYMBOL } from '@/domain/money';
import type { Profile } from '@/domain/types';
import { applyBackup, exportCsv, pickBackup, shareBackup } from '@/features/backup';
import { ListCard, Row, SectionLabel } from '@/features/core/components';
import { editRoute } from '@/features/core/helpers';
import { resetDraft } from '@/features/onboarding/draft';
import { paydaySummary } from '@/features/onboarding/logic';
import { TimeChanger, prettyTime } from '@/features/onboarding/time';
import { cancelReminders, remindersAllowed, requestReminderPermission, scheduleReminders } from '@/features/reminders';
import { actions, getState, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

type ReminderKey = 'morning' | 'evening' | 'quietWeekends';
type Busy = null | 'csv' | 'backup' | 'restore';

export default function Settings() {
  const profile = useStore((s) => s.profile);
  const entryCount = useStore((s) => s.entries.length);
  const [name, setName] = useState(profile.name);
  const [busy, setBusy] = useState<Busy>(null);
  const [allowed, setAllowed] = useState(true);

  // Re-check notification permission each time Settings is shown (it can be changed in phone settings).
  useFocusEffect(
    useCallback(() => {
      let live = true;
      remindersAllowed().then((ok) => live && setAllowed(ok));
      return () => {
        live = false;
      };
    }, []),
  );

  const saveName = () => {
    const n = name.trim();
    if (n && n !== profile.name) actions.updateProfile({ name: n });
    else setName(profile.name);
  };

  const setReminders = async (patch: Partial<Profile['reminders']>) => {
    actions.updateProfile({ reminders: { ...getState().profile.reminders, ...patch } });
    await scheduleReminders(getState().profile);
  };

  const toggle = async (key: ReminderKey, value: boolean) => {
    if (value && key !== 'quietWeekends') {
      const ok = await requestReminderPermission();
      setAllowed(ok);
      if (!ok) {
        Alert.alert('Notifications are off', 'Allow notifications for Pace in your phone settings to get reminders.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open settings', onPress: () => Linking.openSettings() },
        ]);
        return; // the switch stays off
      }
    }
    await setReminders({ [key]: value });
  };

  const run = async (kind: Exclude<Busy, null>, job: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await job();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onExport = () =>
    run('csv', async () => {
      if (!getState().entries.length) {
        Alert.alert('Nothing to export yet', 'Add a spend first and it will show up in the CSV.');
        return;
      }
      await exportCsv();
    });

  const onBackup = () => run('backup', shareBackup);

  const onRestore = () =>
    run('restore', async () => {
      const b = await pickBackup();
      if (!b) return;
      const when = b.exportedAt ? ` from ${prettyDate(b.exportedAt.slice(0, 10))}` : '';
      Alert.alert(
        'Restore this backup?',
        `This backup${when} has ${b.entries} ${b.entries === 1 ? 'entry' : 'entries'}. It replaces your current plan and all ${entryCount} entries on this phone. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              try {
                applyBackup(b);
                router.replace('/');
              } catch (e) {
                Alert.alert('Could not restore', e instanceof Error ? e.message : 'That file is not a Pace backup.');
              }
            },
          },
        ],
      );
    });

  const deleteAll = () => {
    Alert.alert('Delete all data?', 'Your plan, every entry and all settings will be erased from this phone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          await cancelReminders();
          actions.reset();
          resetDraft();
          router.replace('/');
        },
      },
    ]);
  };

  const r = profile.reminders;
  const spinner = (k: Busy) => (busy === k ? <ActivityIndicator color={C.link} /> : undefined);
  const switchProps = { trackColor: { true: C.harbor, false: C.chipLine } };
  const anyOn = r.morning || r.evening;

  return (
    <Screen scroll>
      <Header title="Profile & settings" />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }}>
          <T v="h2" style={{ fontFamily: F.displayBold, fontSize: 20 }}>
            {(profile.name.trim()[0] ?? 'P').toUpperCase()}
          </T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="caption" color={C.inkMuted}>
            Your name
          </T>
          <TextInput
            accessibilityLabel="Your name"
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            placeholder="Add your name"
            placeholderTextColor={C.inkFaint}
            returnKeyType="done"
            style={{ fontFamily: F.display, fontSize: 20, color: C.ink, paddingVertical: 2 }}
          />
        </View>
        <Icon name="edit" size={18} color={C.inkFaint} />
      </Card>

      <SectionLabel>PACE PLUS</SectionLabel>
      <ListCard>
        <Row
          label="Pace Plus · free during early access"
          sub="Every feature is unlocked while Pace is in early access"
          right={<Pill label="ACTIVE" bg={C.okSoft} fg={C.ok} />}
          onPress={() => router.push('/paywall')}
          last
        />
      </ListCard>

      <SectionLabel>REGION</SectionLabel>
      <ListCard>
        <Row label="Country" value={profile.country} onPress={() => router.push({ pathname: '/onboarding/country', params: { edit: '1' } })} />
        <Row
          label="Currency"
          sub="New entries use this currency"
          value={`${profile.currency} · ${SYMBOL[profile.currency].trim()}`}
          onPress={() => router.push({ pathname: '/onboarding/country', params: { edit: '1' } })}
          last
        />
      </ListCard>

      <SectionLabel>BUDGET CYCLE</SectionLabel>
      <ListCard>
        <Row label="Payday" sub={paydaySummary(profile)} onPress={() => router.push(editRoute('pay'))} last />
      </ListCard>

      <SectionLabel>YOUR PLAN</SectionLabel>
      <ListCard>
        <Row label="Income" onPress={() => router.push(editRoute('income'))} />
        <Row label="Bills & subscriptions" onPress={() => router.push(editRoute('bills'))} />
        <Row label="EMIs & loans" onPress={() => router.push(editRoute('emi'))} />
        <Row label="Routine costs" onPress={() => router.push(editRoute('routine'))} />
        <Row label="Weekly pattern & day extras" onPress={() => router.push(editRoute('week'))} />
        <Row label="Savings" onPress={() => router.push(editRoute('savings'))} />
        <Row label="Goals & planned purchases" sub={goalsSub(profile)} onPress={() => router.push('/goals')} />
        <Row label="Categories" sub="Add, rename or remove your own" onPress={() => router.push('/categories')} />
        <Row label="Where you stand today" onPress={() => router.push(editRoute('start'))} last />
      </ListCard>

      <SectionLabel>REMINDERS</SectionLabel>
      {!allowed && anyOn ? (
        <Card style={{ backgroundColor: C.amberSoft, borderColor: C.amberSoft, gap: 6 }}>
          <T v="small" color={C.amberInk} style={{ fontFamily: F.bodySemi }}>
            Notifications are turned off for Pace in your phone settings, so no reminders will arrive.
          </T>
          <T v="small" color={C.link} style={{ fontFamily: F.bodySemi }} onPress={() => Linking.openSettings()} accessibilityRole="link">
            Open phone settings
          </T>
        </Card>
      ) : null}
      <ListCard>
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 8, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="small" style={{ fontSize: 14 }}>
                Morning limit
              </T>
              <T v="caption" color={C.inkMuted}>
                {`"You can spend … today" at ${prettyTime(r.morningAt)}`}
              </T>
            </View>
            <Switch accessibilityLabel="Morning limit reminder" value={r.morning} onValueChange={(v) => toggle('morning', v)} {...switchProps} />
          </View>
          {r.morning ? <TimeChanger label="morning reminder" value={r.morningAt} onChange={(v) => setReminders({ morningAt: v })} /> : null}
        </View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 8, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="small" style={{ fontSize: 14 }}>
                Evening check-in
              </T>
              <T v="caption" color={C.inkMuted}>
                {`"Log today's spends" at ${prettyTime(r.eveningAt)}`}
              </T>
            </View>
            <Switch accessibilityLabel="Evening check-in reminder" value={r.evening} onValueChange={(v) => toggle('evening', v)} {...switchProps} />
          </View>
          {r.evening ? <TimeChanger label="evening reminder" value={r.eveningAt} onChange={(v) => setReminders({ eveningAt: v })} /> : null}
        </View>
        <Row
          label="Quiet weekends"
          sub="No reminders on your days off"
          right={<Switch accessibilityLabel="Quiet weekends" value={r.quietWeekends} onValueChange={(v) => toggle('quietWeekends', v)} {...switchProps} />}
          last
        />
      </ListCard>

      <SectionLabel>YOUR DATA</SectionLabel>
      <ListCard>
        <Row label="Export spending (CSV)" sub={`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}, opens in a spreadsheet`} right={spinner('csv')} onPress={onExport} />
        <Row label="Back up data" sub="Save a file with your plan and every entry" right={spinner('backup')} onPress={onBackup} />
        <Row label="Restore from backup" sub="Replace everything with a Pace backup file" right={spinner('restore')} onPress={onRestore} last />
      </ListCard>

      <SectionLabel>PRIVACY</SectionLabel>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="lock" size={18} />
          <T v="bodySemi">Your money data stays on this phone</T>
        </View>
        <T v="small" color={C.inkMuted} style={{ lineHeight: 19 }}>
          Pace has no account and no server. Your plan, entries and screenshots are stored and read on this device only, and are never uploaded. Exports and backups go only where you choose to share them.
        </T>
      </Card>

      <ListCard>
        <Row label="Delete all data" sub="Erase your plan and every entry from this phone" onPress={deleteAll} last />
      </ListCard>
      <View style={{ height: 12 }} />
    </Screen>
  );
}

function goalsSub(p: Profile): string {
  const n = p.goals?.length ?? 0;
  return n ? `${n} ${n === 1 ? 'goal' : 'goals'}` : 'Save up for something specific';
}
