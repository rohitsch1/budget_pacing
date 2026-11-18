/**
 * Local reminders (expo-notifications, SDK 58). Onboarding, Settings and the root layout call these.
 *
 * - Morning "You can spend X today": one-off DATE triggers for the coming days, each with that day's
 *   projected limit. src/app/_layout.tsx reschedules (debounced) whenever the plan or entries change
 *   and when the app returns to the foreground, so the amounts never go stale.
 * - Evening "Log today's spends": a DAILY trigger, or WEEKLY triggers on work days only when quietWeekends is on.
 * All Pace reminders use identifiers prefixed with `pace.` so they can be cancelled before rescheduling.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, dayPlan, parseISODate, projectedLimits, todayISO, weekdayOf } from '@/domain/budget';
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

/** Whether Pace may post notifications right now (false on web or when denied). */
export async function remindersAllowed(): Promise<boolean> {
  if (!supported) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

const MORNING_DAYS = 7;

/**
 * Morning reminders for the next 7 days as one-off DATE triggers, each carrying that day's projected
 * limit. The app reschedules on every plan/entry change and when it comes to the foreground, so the
 * amounts stay current; one generic reminder per day follows for the week after, in case the app
 * isn't opened for a while.
 */
function morningJobs(profile: Profile, hour: number, minute: number, days: Weekday[]): Promise<string>[] {
  const entries = getState().entries;
  const today = todayISO();
  const now = new Date();
  const jobs: Promise<string>[] = [];
  const limits = new Map<string, number>();
  const plan = dayPlan(profile, entries, today);
  for (const d of projectedLimits(profile, entries, today, MORNING_DAYS)) limits.set(d.date, d.limit);
  for (let i = 0; i < MORNING_DAYS * 2; i++) {
    const date = addDays(today, i);
    if (!days.includes(weekdayOf(date))) continue;
    const at = parseISODate(date);
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= now.getTime() + 30_000) continue;
    let amount: number | null = null;
    if (i < MORNING_DAYS) {
      // Past the end of this cycle the next one starts fresh, so use that day's own plan.
      amount = limits.get(date) ?? (date > plan.cycle.end ? dayPlan(profile, entries, date).limit : null);
    }
    jobs.push(
      Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}morning.${date}`,
        content: {
          title: 'Pace',
          body: amount != null && amount > 0 ? `You can spend ${fmt(amount, profile.currency)} today` : 'See what you can spend today',
          data: { url: '/' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
      }),
    );
  }
  return jobs;
}

let queue: Promise<void> = Promise.resolve();

/**
 * (Re)schedule the morning "today you can spend" + evening "log today's spends" reminders from
 * profile.reminders. Calls are serialised so overlapping reschedules can't leave duplicates.
 */
export function scheduleReminders(profile: Profile): Promise<void> {
  queue = queue.then(() => doSchedule(profile)).catch(() => undefined);
  return queue;
}

async function doSchedule(profile: Profile): Promise<void> {
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
      jobs.push(...morningJobs(profile, hour, minute, days));
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
