import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, TextInput, View } from 'react-native';

import { Card, Header, Icon, Pill, Screen, T } from '@/components/ui';
import { SYMBOL } from '@/domain/money';
import type { Profile } from '@/domain/types';
import { ListCard, Row, SectionLabel } from '@/features/core/components';
import { editRoute, ordinal } from '@/features/core/helpers';
import { resetDraft } from '@/features/onboarding/draft';
import { cancelReminders, requestReminderPermission, scheduleReminders } from '@/features/reminders';
import { actions, getState, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

type ReminderKey = 'morning' | 'evening' | 'quietWeekends';

export default function Settings() {
  const profile = useStore((s) => s.profile);
  const [name, setName] = useState(profile.name);

  const saveName = () => {
    const n = name.trim();
    if (n && n !== profile.name) actions.updateProfile({ name: n });
    else setName(profile.name);
  };

  const toggle = async (key: ReminderKey, value: boolean) => {
    if (value && key !== 'quietWeekends') {
      const ok = await requestReminderPermission();
      if (!ok) {
        Alert.alert('Notifications are off', 'Allow notifications for Pace in your phone settings to get reminders.');
        return;
      }
    }
    const reminders: Profile['reminders'] = { ...getState().profile.reminders, [key]: value };
    actions.updateProfile({ reminders });
    await scheduleReminders(getState().profile);
  };

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
          label={profile.plus ? 'Pace Plus is active' : 'Get Pace Plus'}
          sub={profile.plus ? 'Thanks for supporting Pace' : 'Screenshot import, all insights, full history'}
          right={profile.plus ? <Pill label="ACTIVE" bg={C.okSoft} fg={C.ok} /> : undefined}
          onPress={() => router.push('/paywall')}
          last
        />
      </ListCard>

      <SectionLabel>REGION</SectionLabel>
      <ListCard>
        <Row label="Country" value={profile.country} />
        <Row label="Currency" value={`${profile.currency} · ${SYMBOL[profile.currency].trim()}`} last />
      </ListCard>
      <T v="caption" color={C.inkMuted}>
        Country and currency are set during set-up and keep your history consistent.
      </T>

      <SectionLabel>BUDGET CYCLE</SectionLabel>
      <ListCard>
        <Row label="Payday" sub="Cycle runs payday to the day before the next" value={ordinal(profile.payday)} onPress={() => router.push(editRoute('pay'))} last />
      </ListCard>

      <SectionLabel>YOUR PLAN</SectionLabel>
      <ListCard>
        <Row label="Income" onPress={() => router.push(editRoute('income'))} />
        <Row label="Bills & subscriptions" onPress={() => router.push(editRoute('bills'))} />
        <Row label="EMIs & loans" onPress={() => router.push(editRoute('emi'))} />
        <Row label="Routine costs" onPress={() => router.push(editRoute('routine'))} />
        <Row label="Weekly pattern & day extras" onPress={() => router.push(editRoute('week'))} />
        <Row label="Savings" onPress={() => router.push(editRoute('savings'))} />
        <Row label="Where you stand today" onPress={() => router.push(editRoute('start'))} last />
      </ListCard>

      <SectionLabel>REMINDERS</SectionLabel>
      <ListCard>
        <Row label="Morning limit" sub={`"You can spend … today" at ${r.morningAt}`} right={<Switch value={r.morning} onValueChange={(v) => toggle('morning', v)} trackColor={{ true: C.harbor, false: C.chipLine }} />} />
        <Row label="Evening check-in" sub={`"Log today's spends" at ${r.eveningAt}`} right={<Switch value={r.evening} onValueChange={(v) => toggle('evening', v)} trackColor={{ true: C.harbor, false: C.chipLine }} />} />
        <Row label="Quiet weekends" sub="No reminders on your days off" right={<Switch value={r.quietWeekends} onValueChange={(v) => toggle('quietWeekends', v)} trackColor={{ true: C.harbor, false: C.chipLine }} />} />
        <Row label="Change reminder times" onPress={() => router.push(editRoute('reminders'))} last />
      </ListCard>

      <SectionLabel>PRIVACY</SectionLabel>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="lock" size={18} />
          <T v="bodySemi">Your money data stays on this phone</T>
        </View>
        <T v="small" color={C.inkMuted} style={{ lineHeight: 19 }}>
          Pace has no account and no server. Your plan, entries and screenshots are stored and read on this device only, and are never uploaded.
        </T>
      </Card>

      <ListCard>
        <Row label="Delete all data" sub="Erase your plan and every entry from this phone" onPress={deleteAll} last />
      </ListCard>
      <View style={{ height: 12 }} />
    </Screen>
  );
}
