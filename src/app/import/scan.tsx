import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { Button, Header, Icon, Screen, T } from '@/components/ui';
import { runPipeline, type PipelineResult } from '@/features/capture/pipeline';
import { CheckDot } from '@/features/capture/ui';
import { C, F } from '@/theme/tokens';

type Step = 'wait' | 'run' | 'done' | 'miss';

function go(r: PipelineResult) {
  const route = r.route === 'quick' ? '/import/confirm' : r.route;
  router.replace({ pathname: route, params: { sid: r.session.id } });
}

export default function ImportScan() {
  const params = useLocalSearchParams<{ uri?: string; pendingId?: string }>();
  const [uri, setUri] = useState<string | undefined>(params.uri);
  const [steps, setSteps] = useState<Step[]>(['run', 'wait', 'wait']);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const started = useRef(false);

  // No image given (e.g. "Try it with a recent screenshot"): open the photo picker first.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      let imageUri = params.uri;
      if (!imageUri && !params.pendingId) {
        try {
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
          if (res.canceled || !res.assets[0]?.uri) {
            if (router.canGoBack()) router.back();
            else router.replace('/');
            return;
          }
          imageUri = res.assets[0].uri;
          setUri(imageUri);
        } catch {
          router.replace('/share/unread');
          return;
        }
      }
      const r = await runPipeline({ imageUri, pendingId: params.pendingId, source: 'screenshot' });
      if (!imageUri && r.session.imageUri) setUri(r.session.imageUri);
      const p = r.session.parsed;
      setSteps([p.amount !== null ? 'done' : 'miss', p.direction === 'unknown' ? 'miss' : 'done', 'run']);
      setTimeout(() => {
        setSteps((s) => [s[0], s[1], 'done']);
        setResult(r);
      }, 500);
    })();
  }, [params.uri, params.pendingId]);

  // Move on by itself shortly after reading; "Review now" skips the wait.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => go(result), 700);
    return () => clearTimeout(t);
  }, [result]);

  const p = result?.session.parsed;
  const statusText = !p
    ? 'Checking the payment status'
    : p.direction === 'failed'
      ? 'Status: failed (not counted)'
      : p.direction === 'pending'
        ? 'Status: pending, please check'
        : p.direction === 'in'
          ? 'Status: money received'
          : p.direction === 'out'
            ? 'Status: successful (not failed or pending)'
            : "Status: couldn't tell";
  const foundText = steps[0] === 'miss' ? "Couldn't find the amount, you can type it" : 'Found amount, payee and time';

  return (
    <Screen
      dark
      footer={
        <>
          <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: C.harborMid }}>
            <Icon name="lock" size={18} color={C.mint} />
            <T v="caption" color={C.onDarkMuted} style={{ flex: 1, lineHeight: 18 }}>
              Text is read on your phone. Nothing is uploaded, and your photo stays untouched in your gallery.
            </T>
          </View>
          <Button kind="onDark" label="Review now" disabled={!result} onPress={() => result && go(result)} />
        </>
      }>
      <Header close dark title="Reading screenshot" />
      <View style={{ alignItems: 'center' }}>
        <ScanPreview uri={uri} />
      </View>
      <View style={{ gap: 12, paddingHorizontal: 4 }}>
        <T v="h2" color={C.onDark}>
          Reading your payment…
        </T>
        <StepRow state={steps[0]} label={steps[0] === 'run' ? 'Finding amount, payee and time' : foundText} />
        <StepRow state={steps[1]} label={statusText} />
        <StepRow state={steps[2]} label={steps[2] === 'done' ? (result?.session.duplicateId ? 'Looks like one you already added' : 'Not recorded yet') : "Checking it isn't already recorded"} />
      </View>
    </Screen>
  );
}

function StepRow({ state, label }: { state: Step; label: string }) {
  const active = state === 'done' || state === 'miss';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {state === 'done' ? (
        <CheckDot size={22} bg={C.mint} fg={C.harbor} />
      ) : state === 'miss' ? (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
          <T v="label" color={C.harbor}>
            !
          </T>
        </View>
      ) : state === 'run' ? (
        <ActivityIndicator size="small" color={C.mint} style={{ width: 22, height: 22 }} />
      ) : (
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.harborSoft }} />
      )}
      <T v="body" color={active ? C.onDark : C.onDarkMuted} style={{ fontSize: 14, flex: 1, fontFamily: active ? F.bodyMed : F.body }}>
        {label}
      </T>
    </View>
  );
}

function ScanPreview({ uri }: { uri?: string }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!reduce) y.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduce, y]);
  const line = useAnimatedStyle(() => ({ top: 20 + y.value * 300 }));
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="The payment screenshot"
      style={{ width: 190, height: 340, borderRadius: 22, backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: C.harborLine, overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : null}
      {reduce ? null : <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: C.mint }, line]} />}
    </View>
  );
}
