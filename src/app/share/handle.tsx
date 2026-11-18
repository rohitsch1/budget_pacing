/**
 * Entry point from the OS share sheet (see src/app/+native-intent.ts). Presented as a transparent modal:
 * reads the shared image/text on-device, then either shows the one-tap card (ShareQuick board) or routes
 * to duplicate / received / unread / confirm.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useIncomingShare, type ResolvedSharePayload, type SharePayload } from 'expo-sharing';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, PaceMark, Pill, T } from '@/components/ui';
import { fmt } from '@/domain/money';
import { categoriesFor } from '@/domain/budget';
import { getState } from '@/store';
import { finishSession, impactOf, runPipeline, saveFromSession, type PipelineResult } from '@/features/capture/pipeline';
import { goHome, whenLabel } from '@/features/capture/ui';
import { C, F } from '@/theme/tokens';

type Picked = { imageUri?: string; text?: string; unsupported?: boolean };

function pickPayload(resolved: ResolvedSharePayload[], raw: SharePayload[], failed: boolean): Picked | null {
  const img = resolved.find((p) => p.contentType === 'image' && p.contentUri) ?? resolved.find((p) => p.contentMimeType?.startsWith('image/') && p.contentUri);
  if (img?.contentUri) return { imageUri: img.contentUri };
  const text = raw.find((p) => (p.shareType === 'text' || p.shareType === 'url') && p.value.trim());
  if (text) return { text: text.value };
  const rawImg = raw.find((p) => p.shareType === 'image' && p.value);
  // wait for expo-sharing to copy the file; fall back to the raw URI only if resolving failed
  if (rawImg && !resolved.length) return failed ? { imageUri: rawImg.value } : null;
  if (raw.length || resolved.length) return { unsupported: true }; // PDF etc: we can't read it yet
  return null;
}

export default function ShareHandle() {
  const { sharedPayloads, resolvedSharedPayloads, isResolving, error } = useIncomingShare();
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [empty, setEmpty] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || isResolving) return;
    const picked = pickPayload(resolvedSharedPayloads, sharedPayloads, !!error);
    if (!picked) {
      // Resolution may still be about to start; only give up once nothing is pending.
      if (sharedPayloads.length === 0) {
        const t = setTimeout(() => setEmpty(true), 800);
        return () => clearTimeout(t);
      }
      return;
    }
    handled.current = true;
    if (picked.unsupported) {
      runPipeline({ source: 'share', fromShareSheet: true }).then((r) => router.replace({ pathname: '/share/unread', params: { sid: r.session.id } }));
      return;
    }
    runPipeline({ imageUri: picked.imageUri, text: picked.text, source: 'share', fromShareSheet: true }, { allowQuick: true }).then((r) => {
      if (r.route === 'quick') setResult(r);
      else router.replace({ pathname: r.route, params: { sid: r.session.id } });
    });
  }, [isResolving, resolvedSharedPayloads, sharedPayloads, error]);

  const close = () => (router.canGoBack() ? router.back() : goHome());

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel="Close" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,24,28,.55)' }} />
      {result ? <QuickSheet result={result} /> : <ReadingSheet empty={empty} onClose={close} />}
    </View>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={{ backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 18, gap: 14 }}>
      <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.btnLine }} />
      {children}
    </Animated.View>
  );
}

function ReadingSheet({ empty, onClose }: { empty: boolean; onClose: () => void }) {
  if (empty) {
    return (
      <Sheet>
        <T v="h2">Nothing to read</T>
        <T v="body" color={C.inkMuted}>
          We didn&apos;t get an image or text from that app. Try sharing a screenshot of the receipt, or type the amount.
        </T>
        <Button label="Type it instead" onPress={() => router.replace('/add-expense')} />
        <Button kind="ghost" label="Close" onPress={onClose} />
      </Sheet>
    );
  }
  return (
    <Sheet>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18 }}>
        <PaceMark size={30} />
        <T v="bodySemi" style={{ flex: 1 }}>
          Reading your payment…
        </T>
        <ActivityIndicator color={C.harbor} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="lock" size={16} color={C.inkMuted} />
        <T v="caption" color={C.inkMuted} style={{ flex: 1 }}>
          Read on your phone. Nothing is uploaded.
        </T>
      </View>
    </Sheet>
  );
}

function QuickSheet({ result }: { result: PipelineResult }) {
  const s = result.session;
  const p = s.parsed;
  const amount = p.amount ?? 0;
  const suggested = p.category ?? 'Food';
  const cats = [suggested, ...categoriesFor(getState().profile).filter((c) => c !== suggested)].slice(0, 5);
  const [cat, setCat] = useState(suggested);
  const { before, after } = impactOf({ kind: 'expense', amount, at: p.at });
  const limit = Math.max(1, before.limit);
  const afterPct = Math.max(0, Math.min(100, (after.left / limit) * 100));
  const usePct = Math.max(0, Math.min(100 - afterPct, (Math.min(amount, Math.max(0, before.left)) / limit) * 100));
  const credit = p.methodTag === 'Credit';

  const add = () => {
    saveFromSession(s.id, { amount, category: cat });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    goHome();
  };

  return (
    <Sheet>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <PaceMark size={30} />
        <T v="small" color={C.inkMuted} style={{ flex: 1 }}>
          Read from your{' '}
          <T v="small" style={{ fontFamily: F.bodyBold }}>
            {p.app ?? 'payment'}
          </T>{' '}
          receipt
        </T>
        <Pill label="Read clearly" bg={C.okSoft} fg={C.ok} />
      </View>

      <View style={{ gap: 4 }}>
        <T v="number">{fmt(amount, p.currency)}</T>
        {p.payee ? <T v="bodySemi">{p.payee}</T> : null}
        <T v="small" color={C.inkMuted}>
          {whenLabel(p.at)}
          {p.ref ? ` · ref ••${p.ref.slice(-4)}` : ''}
        </T>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Category" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {cats.map((c) => (
          <Chip key={c} label={c === cat && c === suggested && p.category ? `${c} · suggested` : c} selected={c === cat} onPress={() => setCat(c)} style={{ height: 36 }} />
        ))}
      </View>

      {p.method ? (
        <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="card" size={20} color={C.inkMuted} />
          <T v="bodySemi" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
            {p.method}
          </T>
          {p.methodTag ? <Pill label={p.methodTag} bg={credit ? C.amberSoft : C.linkSoft} fg={credit ? C.amber : C.link} /> : null}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="small" color={C.inkMuted}>
            Left today
          </T>
          <T v="small" style={{ fontFamily: F.bodyBold }}>
            <T v="small" color={C.inkFaint} style={{ textDecorationLine: 'line-through', fontFamily: F.bodyMed }}>
              {fmt(before.left, p.currency)}
            </T>
            {` → ${fmt(after.left, p.currency)}`}
          </T>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ width: `${afterPct}%`, backgroundColor: C.mint }} />
          <View style={{ width: `${usePct}%`, backgroundColor: C.gold }} />
        </View>
      </View>

      <Button label="Add expense" onPress={add} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small kind="secondary" label="Edit details" style={{ flex: 1 }} onPress={() => router.replace({ pathname: '/import/confirm', params: { sid: s.id } })} />
        <Button small kind="ghost" label="Not spending" style={{ flex: 1 }} onPress={() => router.replace({ pathname: '/share/received', params: { sid: s.id } })} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          finishSession(s.id);
          goHome();
        }}
        style={{ alignSelf: 'center', padding: 4 }}>
        <T v="caption" color={C.inkFaint}>
          Discard
        </T>
      </Pressable>
    </Sheet>
  );
}
