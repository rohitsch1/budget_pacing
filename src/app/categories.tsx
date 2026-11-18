import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Header, Icon, Screen, T } from '@/components/ui';
import { BUILTIN_CATEGORIES } from '@/domain/budget';
import { CatBadge, ListCard, SectionLabel } from '@/features/core/components';
import { TextField } from '@/features/onboarding/kit';
import { actions, getState, useStore } from '@/store';
import { C } from '@/theme/tokens';

const RESERVED = [...BUILTIN_CATEGORIES, 'Income'].map((c) => c.toLowerCase());

/** Returns an error message, or null when `name` can be used as a category. */
function problem(name: string, except?: string): string | null {
  const n = name.trim();
  if (!n) return 'Give it a name';
  if (n.length > 24) return 'Keep it under 24 characters';
  const lower = n.toLowerCase();
  if (RESERVED.includes(lower)) return 'That one already exists';
  const custom = getState().profile.customCategories ?? [];
  if (custom.some((c) => c.toLowerCase() === lower && c !== except)) return 'That one already exists';
  return null;
}

/** Move every entry from one category to another. */
function moveEntries(from: string, to: string) {
  for (const e of getState().entries) if (e.category === from) actions.updateEntry(e.id, { category: to });
}

export default function Categories() {
  const custom = useStore((s) => s.profile.customCategories ?? []);
  const entries = useStore((s) => s.entries);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countOf = (c: string) => entries.filter((e) => e.category === c).length;

  const add = () => {
    const err = problem(draft);
    if (err) return setError(err);
    actions.updateProfile({ customCategories: [...custom, draft.trim()] });
    setDraft('');
    setAdding(false);
    setError(null);
  };

  const rename = (old: string) => {
    const n = draft.trim();
    if (n === old) return setRenaming(null);
    const err = problem(n, old);
    if (err) return setError(err);
    actions.updateProfile({ customCategories: custom.map((c) => (c === old ? n : c)) });
    moveEntries(old, n);
    setRenaming(null);
    setDraft('');
    setError(null);
  };

  const remove = (c: string) => {
    const n = countOf(c);
    Alert.alert(
      `Delete “${c}”?`,
      n ? `${n} ${n === 1 ? 'entry' : 'entries'} in this category will move to Other.` : 'No entries use it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            moveEntries(c, 'Other');
            actions.updateProfile({ customCategories: (getState().profile.customCategories ?? []).filter((x) => x !== c) });
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <Header title="Categories" />

      <SectionLabel>YOUR CATEGORIES</SectionLabel>
      <ListCard>
        {custom.length === 0 && !adding ? (
          <T v="small" color={C.inkMuted} style={{ paddingVertical: 14 }}>
            None yet. Add one for anything the built-in list doesn&apos;t cover, like Pets, Kids or Gifts.
          </T>
        ) : null}
        {custom.map((c, i) => (
          <View key={c} style={{ borderBottomWidth: i === custom.length - 1 && !adding ? 0 : 1, borderBottomColor: C.lineSoft, paddingVertical: 8 }}>
            {renaming === c ? (
              <View style={{ gap: 8 }}>
                <TextField label={`Rename ${c}`} value={draft} onChange={(v) => { setDraft(v); setError(null); }} autoFocus />
                {error ? (
                  <T v="caption" color={C.coralInk}>
                    {error}
                  </T>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small kind="secondary" label="Cancel" onPress={() => { setRenaming(null); setError(null); }} style={{ flex: 1 }} />
                  <Button small label="Save" onPress={() => rename(c)} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
                <CatBadge category={c} size={34} />
                <View style={{ flex: 1, gap: 1 }}>
                  <T v="bodySemi" style={{ fontSize: 14 }}>
                    {c}
                  </T>
                  <T v="caption" color={C.inkMuted}>
                    {`${countOf(c)} ${countOf(c) === 1 ? 'entry' : 'entries'}`}
                  </T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${c}`}
                  hitSlop={8}
                  onPress={() => {
                    setRenaming(c);
                    setDraft(c);
                    setAdding(false);
                    setError(null);
                  }}>
                  <Icon name="edit" size={18} color={C.link} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${c}`} hitSlop={8} onPress={() => remove(c)}>
                  <Icon name="trash" size={18} color={C.coralInk} />
                </Pressable>
              </View>
            )}
          </View>
        ))}
        {adding ? (
          <View style={{ gap: 8, paddingVertical: 10 }}>
            <TextField label="New category name" value={draft} onChange={(v) => { setDraft(v); setError(null); }} placeholder="e.g. Pets" autoFocus />
            {error ? (
              <T v="caption" color={C.coralInk}>
                {error}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small kind="secondary" label="Cancel" onPress={() => { setAdding(false); setDraft(''); setError(null); }} style={{ flex: 1 }} />
              <Button small label="Add" onPress={add} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </ListCard>
      {!adding ? (
        <Button
          kind="secondary"
          label="Add a category"
          onPress={() => {
            setAdding(true);
            setRenaming(null);
            setDraft('');
            setError(null);
          }}
        />
      ) : null}

      <SectionLabel>BUILT IN</SectionLabel>
      <ListCard>
        {BUILTIN_CATEGORIES.map((c, i) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: i === BUILTIN_CATEGORIES.length - 1 ? 0 : 1, borderBottomColor: C.lineSoft }}>
            <CatBadge category={c} size={34} />
            <T v="small" style={{ flex: 1, fontSize: 14 }}>
              {c}
            </T>
          </View>
        ))}
      </ListCard>
      <T v="caption" color={C.inkMuted}>
        Built-in categories can&apos;t be changed. Your own categories appear when you add or edit a spend.
      </T>
    </Screen>
  );
}
