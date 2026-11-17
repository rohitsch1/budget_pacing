/** Small building blocks shared by the core screens. */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { Icon, T } from '@/components/ui';
import { WEEKDAY_SHORT, parseISODate, type ISODate } from '@/domain/budget';
import { fmt } from '@/domain/money';
import type { Entry } from '@/domain/types';
import { useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

import { catStyle, entryMeta, entryTitle, isMoneyIn } from './helpers';

export function CatBadge({ category, size = 38 }: { category: string; size?: number }) {
  const c = catStyle(category);
  return (
    <View style={{ width: size, height: size, borderRadius: size > 36 ? 12 : 10, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <T v="caption" color={c.fg} style={{ fontFamily: F.bodyBold, fontSize: size > 36 ? 12 : 11 }}>
        {c.i}
      </T>
    </View>
  );
}

/** One spend / refund row. Tapping opens the entry detail. */
export function EntryRow({ entry, withCategory = true, last = false, compact = false }: { entry: Entry; withCategory?: boolean; last?: boolean; compact?: boolean }) {
  const inMoney = isMoneyIn(entry);
  const badgeCat = inMoney && entry.kind !== 'refund' ? 'Groceries' : entry.category;
  const amount = fmt(entry.amount, entry.currency);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entryTitle(entry)}, ${inMoney ? 'plus' : 'minus'} ${amount}`}
      onPress={() => router.push({ pathname: '/entry/[id]', params: { id: entry.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 54,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: compact ? C.lineSoft : C.line,
        opacity: pressed ? 0.6 : 1,
      })}>
      <CatBadge category={badgeCat} size={compact ? 36 : 38} />
      <View style={{ flex: 1, gap: 1, paddingVertical: 6 }}>
        <T v="bodySemi" style={{ fontSize: compact ? 14 : 15 }} numberOfLines={1}>
          {entryTitle(entry)}
        </T>
        <T v="caption" color={C.inkMuted} numberOfLines={1}>
          {entryMeta(entry, withCategory)}
        </T>
      </View>
      <T v="h3" color={inMoney ? C.ok : C.ink} style={{ fontFamily: F.display, fontSize: compact ? 15 : 16 }}>
        {inMoney ? '+' : '−'}
        {amount}
      </T>
    </Pressable>
  );
}

/** "WED / 18" tile used for bills. */
export function DateTile({ date, bg = C.paper }: { date: ISODate; bg?: string }) {
  const d = parseISODate(date);
  return (
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <T v="caption" color={C.inkMuted} style={{ fontFamily: F.bodyBold, fontSize: 10, lineHeight: 12 }}>
        {WEEKDAY_SHORT[d.getDay()].toUpperCase()}
      </T>
      <T v="h3" style={{ fontFamily: F.display, fontSize: 17, lineHeight: 19 }}>
        {d.getDate()}
      </T>
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
      <T v="small" color={C.inkMuted} style={{ fontFamily: F.bodySemi }}>
        {children}
      </T>
      {right}
    </View>
  );
}

export function LinkText({ label, onPress, icon }: { label: string; onPress: () => void; icon?: string }) {
  return (
    <Pressable accessibilityRole="link" hitSlop={10} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
      {icon ? <Icon name={icon} size={18} color={C.link} /> : null}
      <T v="small" color={C.link} style={{ fontFamily: F.bodySemi }}>
        {label}
      </T>
    </Pressable>
  );
}

/** White rounded list container (rows inside get their own separators). */
export function ListCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: R.lg, paddingHorizontal: 16, paddingVertical: 2 }, style]}>
      {children}
    </View>
  );
}

/** Amber "N shared screenshots waiting for your OK" banner → Confirm. Renders nothing when empty. */
export function PendingBanner() {
  const pending = useStore((s) => s.pending);
  if (!pending.length) return null;
  const n = pending.length;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/import/confirm', params: { pendingId: pending[0].id } })}
      style={({ pressed }) => ({
        backgroundColor: C.amberSoft,
        borderRadius: R.md,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' }}>
        <T v="small" color={C.white} style={{ fontFamily: F.bodyBold }}>
          {n}
        </T>
      </View>
      <T v="small" color={C.amberInk} style={{ flex: 1, fontFamily: F.bodySemi, fontSize: 14 }}>
        {n === 1 ? 'Shared screenshot waiting for your OK' : 'Shared screenshots waiting for your OK'}
      </T>
      <Icon name="chevron" size={18} color={C.amberInk} />
    </Pressable>
  );
}

export function Row({ label, sub, value, onPress, strong = false, last = false, right }: { label: string; sub?: string; value?: string; onPress?: () => void; strong?: boolean; last?: boolean; right?: ReactNode }) {
  const body = (
    <>
      <View style={{ flex: 1, gap: 2, paddingVertical: 8 }}>
        <T v="small" style={{ fontSize: 14, fontFamily: strong ? F.bodySemi : F.body }}>
          {label}
        </T>
        {sub ? (
          <T v="caption" color={C.inkMuted}>
            {sub}
          </T>
        ) : null}
      </View>
      {value ? (
        <T v="h3" style={{ fontFamily: F.display, fontSize: 16 }}>
          {value}
        </T>
      ) : null}
      {right}
      {onPress ? <Icon name="chevron" size={18} color={C.inkFaint} /> : null}
    </>
  );
  const style: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.lineSoft };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  );
}
