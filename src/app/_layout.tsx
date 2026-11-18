import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { scheduleReminders } from '@/features/reminders';
import { getState, subscribe } from '@/store';
import { C } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

/**
 * Keep the morning "You can spend X today" reminders in step with the plan: reschedule (debounced)
 * whenever the profile or entries change, once on start, and whenever the app comes back to the
 * foreground (the day may have rolled over).
 */
function useReminderSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = getState();
    const run = () => {
      const s = getState();
      if (s.onboarded) void scheduleReminders(s.profile);
    };
    const later = (ms = 1500) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    };
    const unsub = subscribe(() => {
      const s = getState();
      if (s.profile !== last.profile || s.entries !== last.entries || s.onboarded !== last.onboarded) later();
      last = s;
    });
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') later(300);
    });
    later(500);
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
      app.remove();
    };
  }, []);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useReminderSync();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="add-expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="share/handle" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="goals" />
          <Stack.Screen name="categories" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
