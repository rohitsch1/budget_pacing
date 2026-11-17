import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Card, Header, Icon, Screen, T } from '@/components/ui';
import { CheckDot } from '@/features/capture/ui';
import { actions, useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

type Region = 'India' | 'US';
const APPS: Record<Region, string[]> = {
  India: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Kiwi', 'CRED', 'Amazon Pay', 'WhatsApp Pay'],
  US: ['Venmo', 'Cash App', 'PayPal', 'Zelle', 'Apple Pay', 'Google Wallet', 'Chime'],
};
const SHEET = ['Messages', 'Mail', 'Pace', 'Drive', 'More'];

export default function ShareHowTo() {
  const profileRegion = useStore((s) => s.profile.region);
  const [region, setRegion] = useState<Region>(profileRegion === 'US' ? 'US' : 'India');

  useEffect(() => {
    actions.markShareHowToSeen();
  }, []);

  const payEx = region === 'India' ? 'GPay, PhonePe, Paytm or any UPI app' : 'Venmo, Cash App, PayPal or your bank';

  return (
    <Screen scroll footer={<Button label="Try it with a recent screenshot" onPress={() => router.push('/import/scan')} />}>
      <Header
        right={
          <View accessibilityRole="radiogroup" accessibilityLabel="Region" style={{ flexDirection: 'row', padding: 3, borderRadius: R.pill, backgroundColor: C.sand }}>
            {(['India', 'US'] as Region[]).map((r) => {
              const on = r === region;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setRegion(r)}
                  style={{ height: 32, paddingHorizontal: 14, borderRadius: R.pill, backgroundColor: on ? C.harbor : 'transparent', justifyContent: 'center' }}>
                  <T v="small" color={on ? C.white : C.ink} style={{ fontFamily: F.bodySemi }}>
                    {r}
                  </T>
                </Pressable>
              );
            })}
          </View>
        }
      />

      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 6 }}>
        <T v="h1" style={{ fontSize: 27, lineHeight: 31 }}>
          Add any payment in two taps
        </T>
        <T v="body" color={C.inkMuted} style={{ fontSize: 14 }}>
          Works with every payment app. No bank login, no reading your messages.
        </T>
      </Animated.View>

      <View style={{ gap: 8 }}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 18 }}>
            <StepNum n={1} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodySemi">Pay as you always do</T>
              <T v="caption" color={C.inkMuted}>
                In {payEx}
              </T>
            </View>
            <CheckDot size={30} bg={C.success} />
          </Card>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(220).duration(400)}>
          <Card style={{ gap: 10, paddingVertical: 12, borderRadius: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <StepNum n={2} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodySemi">Tap Share, then Pace</T>
                <T v="caption" color={C.inkMuted}>
                  No Share button? Take a screenshot and share that.
                </T>
              </View>
            </View>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F2F2EF' }}>
              {SHEET.map((s) => {
                const pace = s === 'Pace';
                return (
                  <View key={s} style={{ alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: pace ? C.harbor : '#D9D9D6',
                        borderWidth: pace ? 3 : 0,
                        borderColor: C.mint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {pace ? (
                        <T v="small" color={C.mint} style={{ fontFamily: F.displayBold }}>
                          p
                        </T>
                      ) : null}
                    </View>
                    <T v="caption" color="#555" style={{ fontSize: 10 }}>
                      {s}
                    </T>
                  </View>
                );
              })}
            </View>
          </Card>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(340).duration(400)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderRadius: 18 }}>
            <StepNum n={3} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodySemi">Check it, tap Add</T>
              <T v="caption" color={C.inkMuted}>
                Today&apos;s number updates straight away
              </T>
            </View>
          </Card>
        </Animated.View>
      </View>

      <View style={{ gap: 8 }}>
        <T v="label" color={C.inkMuted}>
          WORKS WITH
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {APPS[region].map((a) => (
            <AppChip key={a} label={a} />
          ))}
          <AppChip label="Any bank app" tint />
          <AppChip label="Any screenshot" tint />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: C.linkSoft }}>
        <Icon name="pin" size={16} color="#0F4E5C" />
        <T v="caption" color="#0F4E5C" style={{ flex: 1, lineHeight: 17 }}>
          Keep Pace first in the list: on Android, long-press Pace and choose Pin. On iPhone, tap More, then add Pace to Favourites.
        </T>
      </View>
    </Screen>
  );
}

function StepNum({ n }: { n: number }) {
  return (
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.harbor, alignItems: 'center', justifyContent: 'center' }}>
      <T v="small" color={C.mint} style={{ fontFamily: F.displayBold, fontSize: 14 }}>
        {n}
      </T>
    </View>
  );
}

function AppChip({ label, tint = false }: { label: string; tint?: boolean }) {
  return (
    <View style={{ height: 30, paddingHorizontal: 11, borderRadius: R.pill, backgroundColor: tint ? C.mintSoft : C.white, justifyContent: 'center' }}>
      <T v="caption" color={tint ? C.ok : C.ink} style={{ fontFamily: F.bodySemi }}>
        {label}
      </T>
    </View>
  );
}
