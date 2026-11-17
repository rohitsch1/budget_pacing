import { Stack } from 'expo-router';

import { C } from '@/theme/tokens';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper }, animation: 'slide_from_right' }} />;
}
