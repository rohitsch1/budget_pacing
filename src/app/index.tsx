import { Redirect } from 'expo-router';

import { useStore } from '@/store';

/** Entry gate: first launch goes to onboarding, afterwards straight to Today. */
export default function Index() {
  const onboarded = useStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding/welcome'} />;
}
