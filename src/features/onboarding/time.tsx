/**
 * Time and date pickers (@react-native-community/datetimepicker).
 * Android opens the system dialog; iOS shows an inline spinner under the row; web falls back to presets.
 */
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { addDays, parseISODate, prettyDate, toISODate, todayISO } from '@/domain/budget';
import { C, F } from '@/theme/tokens';

/** "08:30" → "8:30 am" */
export function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

function toDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const WEB_PRESETS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '12:30', '18:00', '19:00', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];

function LinkLabel({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
      <T v="caption" color={C.link} style={{ fontFamily: F.bodySemi }}>
        {label}
      </T>
    </Pressable>
  );
}

/** "Change time" link that opens a real time picker. */
export function TimeChanger({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const a11y = `Change ${label} time, now ${prettyTime(value)}`;

  if (Platform.OS === 'android') {
    return (
      <LinkLabel
        label="Change time"
        a11y={a11y}
        onPress={() =>
          DateTimePickerAndroid.open({
            value: toDate(value),
            mode: 'time',
            is24Hour: false,
            onValueChange: (_e, d) => onChange(toHHMM(d)),
          })
        }
      />
    );
  }
  if (Platform.OS !== 'ios') {
    const i = WEB_PRESETS.indexOf(value);
    return <LinkLabel label="Change time" a11y={a11y} onPress={() => onChange(WEB_PRESETS[(i + 1) % WEB_PRESETS.length])} />;
  }
  return (
    <View style={{ gap: 4 }}>
      <LinkLabel label={open ? 'Done' : 'Change time'} a11y={open ? 'Done choosing time' : a11y} onPress={() => setOpen((o) => !o)} />
      {open ? (
        <DateTimePicker value={toDate(value)} mode="time" display="spinner" onValueChange={(_e, d) => onChange(toHHMM(d))} style={{ height: 160 }} />
      ) : null}
    </View>
  );
}

/** A tappable date row ("Fri 27 Nov") that opens a date picker. */
export function DateField({
  value,
  onChange,
  label,
  minimumDate,
  maximumDate,
}: {
  value: string | null | undefined;
  onChange: (iso: string) => void;
  label: string;
  minimumDate?: string;
  maximumDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const iso = value || todayISO();
  const min = minimumDate ? parseISODate(minimumDate) : undefined;
  const max = maximumDate ? parseISODate(maximumDate) : undefined;

  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseISODate(iso),
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onValueChange: (_e, d) => onChange(toISODate(d)),
      });
    } else if (Platform.OS === 'ios') {
      setOpen((o) => !o);
    } else {
      // web fallback: step a week forward
      onChange(addDays(iso, 7));
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? prettyDate(iso) : 'not set'}`}
        onPress={press}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          minHeight: 48,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: open ? C.harbor : C.line,
          backgroundColor: pressed ? C.lineSoft : C.white,
        })}>
        <T v="caption" color={C.inkMuted}>
          {label}
        </T>
        <T v="bodySemi" color={value ? C.ink : C.inkDisabled} style={{ fontSize: 15 }}>
          {value ? prettyDate(iso) : 'Pick a date'}
        </T>
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={parseISODate(iso)}
          mode="date"
          display="inline"
          minimumDate={min}
          maximumDate={max}
          onValueChange={(_e, d) => {
            onChange(toISODate(d));
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
