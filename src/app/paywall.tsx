import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Button, Icon, Pill, Screen, T } from '@/components/ui';
import { useStore } from '@/store';
import { C, F, R } from '@/theme/tokens';

const PERKS = [
  { t: 'Screenshot and receipt import', s: 'Any UPI, wallet or bank app, any language' },
  { t: 'Unlimited categories and income sources', s: 'Free plan: 8 categories, 1 income source' },
  { t: 'All insights and full history', s: 'Free plan: 2 insights, current cycle' },
  { t: 'Goals, planned purchases and exports', s: 'CSV and PDF reports' },
  { t: 'Smart reminders', s: 'Learns when you usually spend' },
];

/**
 * Display prices only. TODO(billing): load localized prices and products from the store
 * (Google Play Billing / StoreKit, e.g. via a RevenueCat or expo-iap integration) and replace these.
 */
const PRICES = {
  IN: { year: '₹1,499', yearSub: 'About ₹125 a month', save: 'Save 17%', month: '₹150' },
  US: { year: '$89', yearSub: 'About $7.42 a month', save: 'Save 18%', month: '$9' },
} as const;

type PlanId = 'year' | 'month';

export default function Paywall() {
  const region = useStore((s) => s.profile.region);
  const isPlus = useStore((s) => s.profile.plus);
  const [plan, setPlan] = useState<PlanId>('year');
  const price = region === 'IN' ? PRICES.IN : PRICES.US;
  const storeName = Platform.OS === 'ios' ? 'the App Store' : 'Google Play';
  const fine = plan === 'year' ? `Free for 7 days, then ${price.year} a year.` : `Free for 7 days, then ${price.month} a month.`;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const comingSoon = () => {
    // TODO(billing): start the store purchase / restore flow, then actions.updateProfile({ plus: true }) on success.
    Alert.alert('Purchases open soon', 'Pace Plus is not on sale yet. We will let you know as soon as it is.');
  };

  const plans: { id: PlanId; n: string; s: string; tag?: string }[] = [
    { id: 'year', n: `Yearly · ${price.year}`, s: price.yearSub, tag: price.save },
    { id: 'month', n: `Monthly · ${price.month}`, s: 'Billed every month' },
  ];

  return (
    <Screen
      dark
      scroll
      footer={
        isPlus ? (
          <Button kind="mint" label="Done" onPress={close} />
        ) : (
          <>
            <Button kind="mint" label="Start 7-day free trial" onPress={comingSoon} />
            <T v="caption" color={C.onDarkMuted} style={{ textAlign: 'center', fontSize: 11, lineHeight: 16 }}>
              {`${fine} Cancel anytime in ${storeName}. Prices are loaded from the store for your country.`}
            </T>
          </>
        )
      }>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={close} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }}>
          <Icon name="close" color={C.onDark} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {!isPlus ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={comingSoon}>
            <T v="small" color={C.onDark} style={{ fontFamily: F.bodySemi, fontSize: 14 }}>
              Restore purchase
            </T>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Pill label="PACE PLUS" bg={C.mint} fg={C.harbor} />
        <T v="h1" color={C.onDark} style={{ fontSize: 30, lineHeight: 33, letterSpacing: -0.8 }}>
          {isPlus ? "You're on Pace Plus" : 'Stop typing. Share the screenshot.'}
        </T>
      </View>

      <View style={{ gap: 12 }}>
        {PERKS.map((p) => (
          <View key={p.t} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.harborMid, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={14} color={C.mint} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodySemi" color={C.onDark}>
                {p.t}
              </T>
              <T v="small" color={C.onDarkMuted}>
                {p.s}
              </T>
            </View>
          </View>
        ))}
      </View>

      {!isPlus ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          {plans.map((p) => {
            const on = p.id === plan;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setPlan(p.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: on ? C.mint : C.harborLine,
                  backgroundColor: on ? '#12505E' : 'transparent',
                }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? C.mint : C.harborLine, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.mint }} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="bodySemi" color={C.onDark}>
                    {p.n}
                  </T>
                  <T v="caption" color={C.onDarkMuted}>
                    {p.s}
                  </T>
                </View>
                {p.tag ? <Pill label={p.tag} bg={C.mint} fg={C.harbor} style={{ borderRadius: R.pill }} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
