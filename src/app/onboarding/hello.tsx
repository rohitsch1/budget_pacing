import { View } from 'react-native';

import { Button, T } from '@/components/ui';
import { Bubble, ObScaffold, OptionRow, Reply, TextField, useObFlow } from '@/features/onboarding/kit';
import { actions, useStore } from '@/store';

const MOODS = [
  { id: 'control', t: 'Pretty much in control', r: 'Great. Pace will help you keep it that way and spot where small savings hide.' },
  { id: 'getting', t: 'Getting by, but no idea where it goes', r: 'Very common. A daily number makes the invisible spending visible.' },
  { id: 'short', t: 'Often short before payday', r: 'You’re not alone. We’ll pace your money so the last week feels as easy as the first.' },
  { id: 'new', t: 'Just started earning', r: 'Perfect time to start. We’ll keep it simple and build good habits early.' },
];

export default function Hello() {
  const name = useStore((s) => s.profile.name);
  const feeling = useStore((s) => s.profile.feeling);
  const flow = useObFlow('/onboarding/country');
  const first = name.trim().split(/\s+/)[0];
  const mood = MOODS.find((m) => m.id === feeling);

  return (
    <ObScaffold
      chapter="ABOUT YOU"
      footer={<Button label={flow.label('Continue')} disabled={!name.trim()} onPress={() => { actions.updateProfile({ name: name.trim() }); flow.go(); }} />}>
      <Bubble>Hi, I&apos;m Pace. I&apos;ll ask a few easy questions about your money. Rough numbers are perfect, and you can change anything later.</Bubble>

      <View style={{ gap: 8 }}>
        <T v="h2">What should I call you?</T>
        <TextField big label="Your name" value={name} onChange={(v) => actions.updateProfile({ name: v })} placeholder="Your first name" />
      </View>

      {first ? (
        <>
          <Bubble delay={0}>{`Nice to meet you, ${first}. Honestly, how does money feel at the moment?`}</Bubble>
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {MOODS.map((m) => (
              <OptionRow key={m.id} label={m.t} selected={feeling === m.id} onPress={() => actions.updateProfile({ feeling: m.id })} />
            ))}
          </View>
          {mood ? <Reply k={mood.id}>{mood.r}</Reply> : null}
        </>
      ) : null}
    </ObScaffold>
  );
}
