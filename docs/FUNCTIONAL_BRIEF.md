# Making Pace fully functional — shared brief

App: Expo SDK 58 / React Native / Expo Router, TypeScript strict, at /Users/rohitpersonal/pace-app.
Read AGENTS.md first. Expo APIs change every SDK: before using any expo-* or RN library API, check the
SDK 58 docs (https://docs.expo.dev/versions/v58.0.0/ and https://docs.expo.dev/llms.txt). Notably
expo-file-system in SDK 58 uses the `File` / `Paths` / `Directory` classes API.

## Already done (do not redo) — the data model, commit a1dbf5b
- `src/domain/types.ts`: Profile gained `payFrequency` ('monthly'|'weekly'|'fortnightly'), `payAnchor`,
  `irregularFactor`, `start.auto`, `savedSoFar`, `debts: Debt[]` ({id,label,amount,dir:'owe'|'owed'}),
  `goals: Goal[]` ({id,name,amount,targetDate,saved,createdAt}), `customCategories`, `overAckDate`.
  Emi gained `endDate`. Entry gained `refundOf`. PendingImport gained `source`.
- `src/domain/budget.ts`: `cycleOf(p, date)` (USE THIS everywhere instead of `cycleFor(date, p.payday)`),
  `nextPayday(p)`, `activeEmis(p)`, `emiMonthsLeft(e)`, `goalMonthly(g)`, `monthsUntil`,
  `planTotals(p)` now returns {income (after irregular buffer), incomeEntered, irregularBuffer, bills,
  emis (active only), routine, savings, goals, flexible}, `cycleFlexible(p, cycle)`,
  `categoriesFor(p)` (built-ins incl. 'Bills' + custom, 'Other' last), `BUILTIN_CATEGORIES`.
  dayPlan honours `start.auto` (joined mid-cycle → share of the *current* plan, so plan edits apply).
- `src/store/index.ts`: `plus` is always true (Pace Plus free during early access — no billing),
  `migrate()`, `actions.restore(json)`, `subscribe(fn)`, `getState()`. Use `actions.updateProfile`
  for profile fields (debts, goals, customCategories, overAckDate …).
- `src/theme/tokens.ts`: `catStyle(name)` gives colours/initials for ANY category incl. custom and 'Income'.
- Installed: `@react-native-community/datetimepicker`, `expo-document-picker`, `expo-file-system`
  (plus existing expo-sharing, expo-notifications).

## Rules
- Only edit files you OWN (listed in your task). Other agents are editing the rest at the same time.
  Files nobody may edit: src/domain/*, src/store/*, src/theme/*, src/components/ui.tsx, package.json,
  app.json, android/. If you need a change there, describe it in your final report instead.
- Match existing visual style (components in src/components/ui.tsx, tokens in src/theme/tokens.ts).
- Never use console.log for anything important (stripped in release). No debug logging of user data.
- Do not commit. Do not run the Android build or emulator (the lead does that at the end).
- Before finishing: `npx tsc --noEmit` and `npx expo lint` must be clean for your files.
- Final report: what you changed per file, anything you could not do, any change you need in
  files you don't own.
