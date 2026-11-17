import { router, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, T } from '@/components/ui';
import { C, F } from '@/theme/tokens';

const TABS: { name: string; label: string; icon: string }[] = [
  { name: 'index', label: 'Today', icon: 'today' },
  { name: 'activity', label: 'Activity', icon: 'list' },
  { name: 'plan', label: 'Plan', icon: 'calendar' },
  { name: 'insights', label: 'Insights', icon: 'chart' },
];

/** Four tabs plus the always-present centre Add button (design: Navigation map). */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.paper } }}
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          state={state}
          navigate={(n) => {
            const route = state.routes.find((r) => r.name === n);
            if (route) navigateToTab(route.key);
          }}
        />
      )}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

function TabBar({ state, navigate }: { state: { index: number; routes: { name: string; key: string }[] }; navigate: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const item = (t: (typeof TABS)[number]) => {
    const on = current === t.name;
    return (
      <Pressable
        key={t.name}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.label}
        onPress={() => navigate(t.name)}
        style={{ alignItems: 'center', gap: 4, minWidth: 64 }}>
        <View style={{ paddingHorizontal: 18, paddingVertical: 4, borderRadius: 999, backgroundColor: on ? C.mintSoft : 'transparent' }}>
          <Icon name={t.icon} color={on ? C.ink : C.inkMuted} />
        </View>
        <T v="caption" color={on ? C.ink : C.inkMuted} style={{ fontFamily: on ? F.bodyBold : F.bodyMed }}>
          {t.label}
        </T>
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: C.white,
        borderTopWidth: 1,
        borderTopColor: C.line,
        paddingTop: 8,
        paddingBottom: insets.bottom + 8,
        paddingHorizontal: 8,
      }}>
      {item(TABS[0])}
      {item(TABS[1])}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        onPress={() => router.push('/add-expense')}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: C.harbor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.95 : 1 }],
        })}>
        <Icon name="plus" color={C.mint} size={26} strokeWidth={2.4} />
      </Pressable>
      {item(TABS[2])}
      {item(TABS[3])}
    </View>
  );
}
