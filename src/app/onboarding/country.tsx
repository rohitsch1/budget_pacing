import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Chip, Icon, T } from '@/components/ui';
import { currencyForCountry, fmt } from '@/domain/money';
import type { CurrencyCode } from '@/domain/types';
import { Bubble, LinkButton, ObScaffold, useObFlow } from '@/features/onboarding/kit';
import { COUNTRIES, CURRENCY_NAMES } from '@/features/onboarding/logic';
import { actions, useStore } from '@/store';
import { C, F } from '@/theme/tokens';

const ALL_CURRENCIES = Object.keys(CURRENCY_NAMES) as CurrencyCode[];

export default function Country() {
  const profile = useStore((s) => s.profile);
  const flow = useObFlow('/onboarding/pay');
  const [q, setQ] = useState('');
  const [showCur, setShowCur] = useState(false);
  const first = profile.name.trim().split(/\s+/)[0];

  const list = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const info = COUNTRIES.find((c) => c.name === profile.country);

  const pick = (name: string) => {
    const c = COUNTRIES.find((x) => x.name === name);
    actions.updateProfile({ country: name, region: c?.region ?? 'OTHER', currency: currencyForCountry(name) });
  };

  return (
    <ObScaffold chapter="ABOUT YOU" footer={<Button label={flow.label("That's right")} onPress={flow.go} />}>
      <Bubble>{`Where are you based${first ? `, ${first}` : ''}? I'll set your currency, how numbers are written and which payment apps to recognise.`}</Bubble>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }}>
          <Icon name="search" size={18} color={C.inkMuted} />
          <TextInput
            accessibilityLabel="Search countries"
            value={q}
            onChangeText={setQ}
            placeholder="Search countries"
            placeholderTextColor={C.inkMuted}
            autoCorrect={false}
            style={{ flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, padding: 0 }}
          />
        </View>
        <View style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' }}>
          {list.map((c, i) => {
            const on = c.name === profile.country;
            return (
              <Pressable
                key={c.code}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => pick(c.name)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 50, paddingHorizontal: 16, backgroundColor: on ? '#E6F6EE' : C.white, borderTopWidth: i ? 1 : 0, borderTopColor: C.lineSoft }}>
                <T v="caption" color={C.inkMuted} style={{ width: 32, fontFamily: F.bodyBold }}>
                  {c.code}
                </T>
                <T v="body" style={{ flex: 1, fontFamily: F.bodyMed }}>
                  {c.name}
                </T>
                {on ? <Icon name="check" size={20} color={C.link} strokeWidth={2.5} /> : null}
              </Pressable>
            );
          })}
          {list.length === 0 ? (
            <View style={{ padding: 16, gap: 4 }}>
              <T v="bodySemi">Not in the list yet</T>
              <T v="small" color={C.inkMuted}>
                Pick the currency you&apos;re paid in below and Pace will work just the same.
              </T>
            </View>
          ) : null}
        </View>
      </View>

      <Bubble delay={300}>
        <View style={{ gap: 8 }}>
          <T v="body">Got it. Here&apos;s how things will look:</T>
          {[
            ['Currency', CURRENCY_NAMES[profile.currency]],
            ['Amounts', fmt(100000, profile.currency, { decimals: true })],
            ['Dates', info?.date ?? '15/11/2026'],
            ['Payment apps', info?.apps ?? 'Banking apps, PayPal'],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T v="small" color={C.inkMuted}>
                {k}
              </T>
              <T v="small" style={{ fontFamily: F.bodySemi, flexShrink: 1, textAlign: 'right' }}>
                {v}
              </T>
            </View>
          ))}
          <LinkButton label={showCur ? 'Hide currency options' : 'Use a different currency'} onPress={() => setShowCur((x) => !x)} />
          {showCur ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ALL_CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={profile.currency === c} onPress={() => actions.updateProfile({ currency: c })} />
              ))}
            </View>
          ) : null}
        </View>
      </Bubble>
    </ObScaffold>
  );
}
