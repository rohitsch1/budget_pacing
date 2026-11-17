/**
 * Local reminders (expo-notifications, SDK 58). OWNER: core agent; onboarding + settings call these.
 *
 * - Morning "You can spend X today": one WEEKLY trigger per weekday, because the amount differs by
 *   weekday (office / weekend / day extras). The amount is the projected limit for the next occurrence;
 *   Today re-runs scheduleReminders whenever the limit changes so the numbers stay fresh.
 * - Evening "Log today's spends": a DAILY trigger, or WEEKLY triggers on work days only when quietWeekends is on.
 * All Pace reminders use identifiers prefixed with `pace.` so they can be cancelled before rescheduling.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dayPlan, projectedLimits, todayISO, weekdayOf } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Profile, Weekday } from '@/domain/types';
import { getState } from '@/store';

const CHANNEL_ID = 'reminders';
const PREFIX = 'pace.';
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

// Show reminders even when the app is in the foreground.
if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily reminders',
    description: 'Morning limit and evening logging reminders',
    importance: AndroidImportance.DEFAULT,
  });
}

/** Ask for notification permission (creates the Android channel first). Returns true when granted. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/** Cancel every Pace reminder (used before rescheduling and by "Delete all data"). */
export async function cancelReminders(): Promise<void> {
  if (!supported) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}

function parseTime(s: string, fallback: [number, number]): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  if (!m) return fallback;
  return [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))];
}

/** Projected limit for the next morning reminder on each weekday (0 = Sunday). */
function morningAmounts(profile: Profile, hour: number, minute: number): Map<Weekday, number> {
  const entries = getState().entries;
  const today = todayISO();
  const out = new Map<Weekday, number>();
  const now = new Date();
  const beforeMorning = now.getHours() < hour || (now.getHours() === hour && now.getMinutes() < minute);
  if (beforeMorning) out.set(weekdayOf(today), dayPlan(profile, entries, today).limit);
  for (const d of projectedLimits(profile, entries, addDays(today, 1), 7)) {
    const wd = weekdayOf(d.date);
    if (!out.has(wd)) out.set(wd, d.limit);
  }
  return out;
}

/** (Re)schedule the morning "today you can spend" + evening "log today's spends" reminders from profile.reminders. */
export async function scheduleReminders(profile: Profile): Promise<void> {
  if (!supported) return;
  try {
    await cancelReminders();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await ensureChannel();

    const r = profile.reminders;
    const days: Weekday[] = r.quietWeekends ? profile.workDays : [0, 1, 2, 3, 4, 5, 6];
    const jobs: Promise<string>[] = [];

    if (r.morning) {
      const [hour, minute] = parseTime(r.morningAt, [8, 30]);
      const amounts = morningAmounts(profile, hour, minute);
      for (const wd of days) {
        const amount = amounts.get(wd);
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}morning.${wd}`,
            content: {
              title: 'Pace',
              body:
                amount != null && amount > 0
                  ? `You can spend ${fmt(amount, profile.currency)} today`
                  : 'See what you can spend today',
              data: { url: '/' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              channelId: CHANNEL_ID,
              weekday: wd + 1, // expo: 1 = Sunday
              hour,
              minute,
            },
          }),
        );
      }
    }

    if (r.evening) {
      const [hour, minute] = parseTime(r.eveningAt, [21, 0]);
      const content = { title: 'Pace', body: "Log today's spends, it takes a few seconds", data: { url: '/add-expense' } };
      if (r.quietWeekends) {
        for (const wd of days) {
          jobs.push(
            Notifications.scheduleNotificationAsync({
              identifier: `${PREFIX}evening.${wd}`,
              content,
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                channelId: CHANNEL_ID,
                weekday: wd + 1,
                hour,
                minute,
              },
            }),
          );
        }
      } else {
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}evening`,
            content,
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, channelId: CHANNEL_ID, hour, minute },
          }),
        );
      }
    }
    await Promise.all(jobs);
  } catch {
    // scheduling is best-effort
  }
}
