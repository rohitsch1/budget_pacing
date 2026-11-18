/**
 * Tappable "when" field: shows "Today, 2:40 pm" / "Tue 17 Nov, 8:00 pm" and opens the native picker.
 * Android: date dialog, then time dialog (DateTimePickerAndroid.open). iOS: inline picker in a sheet.
 * Value / onChange use the local ISO string entries are stored with: 'yyyy-mm-ddTHH:mm:00' (no timezone).
 * Dates after now are not allowed.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View, type ViewStyle } from 'react-native';

import { Button, Icon, T } from '@/components/ui';
import { addDays, MONTH_SHORT, todayISO, WEEKDAY_SHORT } from '@/domain/budget';
import { C, F, R } from '@/theme/tokens';

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'yyyy-mm-ddTHH:mm:00' in local time. */
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** 'yyyy-mm-dd[THH:mm[:ss]]' → local Date (falls back to now when unreadable). */
export function fromLocalISO(at: string | null | undefined): Date {
  const m = at ? /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(at) : null;
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 12), Number(m[5] ?? 0), 0, 0);
}

/** "2:40 pm" */
export function clock12(d: Date): string {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Today, 2:40 pm" · "Yesterday, 8:00 pm" · "Tue 17 Nov, 8:00 pm" (year added when not this year) */
export function formatWhen(at: string | null | undefined): string {
  const d = fromLocalISO(at);
  const day = toLocalISO(d).slice(0, 10);
  const today = todayISO();
  let label: string;
  if (day === today) label = 'Today';
  else if (day === addDays(today, -1)) label = 'Yesterday';
  else {
    label = `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
    if (d.getFullYear() !== new Date().getFullYear()) label += ` ${d.getFullYear()}`;
  }
  return `${label}, ${clock12(d)}`;
}

function clampToNow(d: Date): Date {
  const now = new Date();
  return d.getTime() > now.getTime() ? now : d;
}

export function DateTimeField({
  value,
  onChange,
  label = 'When',
  style,
  compact = false,
}: {
  value: string;
  onChange: (at: string) => void;
  label?: string;
  style?: ViewStyle;
  /** small 44pt pill (for rows of inputs) instead of the full-width field */
  compact?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => fromLocalISO(value));

  const open = () => {
    const current = clampToNow(fromLocalISO(value));
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: current,
        maximumDate: new Date(),
        onValueChange: (_e, picked) => {
          const withDay = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), current.getHours(), current.getMinutes());
          DateTimePickerAndroid.open({
            mode: 'time',
            value: clampToNow(withDay),
            is24Hour: false,
            onValueChange: (_e2, t) => {
              const final = new Date(withDay.getFullYear(), withDay.getMonth(), withDay.getDate(), t.getHours(), t.getMinutes());
              onChange(toLocalISO(clampToNow(final)));
            },
            // time dismissed: keep the new day with the old time
            onDismiss: () => onChange(toLocalISO(clampToNow(withDay))),
          });
        },
      });
      return;
    }
    if (Platform.OS === 'ios') {
      setDraft(current);
      setIosOpen(true);
    }
  };

  const text = formatWhen(value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}. Tap to change`}
        onPress={open}
        style={({ pressed }) => [
          compact
            ? { height: 44, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }
            : { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
          { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.7 : 1 },
          style,
        ]}>
        {compact ? null : <Icon name="calendar" size={18} color={C.inkMuted} />}
        <T v={compact ? 'small' : 'bodySemi'} style={compact ? { fontFamily: F.bodySemi } : { flex: 1, fontSize: 15 }} numberOfLines={1}>
          {text}
        </T>
        {compact ? null : <Icon name="edit" size={16} color={C.inkMuted} />}
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable accessibilityLabel="Close" onPress={() => setIosOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(8,24,28,.45)' }} />
          <View style={{ backgroundColor: C.paper, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: 20, paddingBottom: 36, gap: 12 }}>
            <T v="h3">{label}</T>
            <DateTimePicker
              value={draft}
              mode="datetime"
              display="inline"
              maximumDate={new Date()}
              accentColor={C.harbor}
              onValueChange={(_e, d) => setDraft(d)}
            />
            <Button
              label="Done"
              onPress={() => {
                onChange(toLocalISO(clampToNow(draft)));
                setIosOpen(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </>
  );
}
