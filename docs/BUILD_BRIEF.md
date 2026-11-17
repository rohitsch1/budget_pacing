# Pace — build brief for parallel agents

Pace is a personal-finance app built around one number: **how much you can spend today**. The approved
high-fidelity design is a set of HTML boards (one per screen, 390×844) at:

`/private/tmp/claude-502/-Users-rohitpersonal-playnearbygamesmobile/07f9a4d1-dd2c-4a73-bb1d-7cf4e79e87b7/scratchpad/work/project/`

Each `<Name>.dc.html` holds the markup (inline styles = exact colours, sizes, copy) and a `renderVals()` script
with the sample data/logic. `canvas.json` maps file → board title. `Main.dc.html` is the design system,
`NavMap.dc.html` the navigation map. **Match the copy, layout, colours and interactions of the boards.**
Ignore the `.dc.html` template syntax (`{{x}}`, `<sc-for>`, `<sc-if>`) — just translate to React Native.

## Stack (Expo SDK 58, RN 0.88, React 19.3, Expo Router, TypeScript strict)

- Expo docs for this SDK: https://docs.expo.dev/versions/v58.0.0/ — do not rely on memory for Expo APIs.
- **Do not add or install packages.** Installed: expo-router, expo-sharing (receive shares), expo-sqlite (kv-store),
  expo-notifications, expo-text-extractor (OCR: `extractTextFromImage(uri): Promise<string[]>`, `isSupported`),
  expo-haptics, expo-image-picker, expo-image, react-native-svg, react-native-reanimated 4,
  react-native-gesture-handler, react-native-safe-area-context, expo-localization. If you truly need something else, stop and say so in your report.
- Styling: plain `StyleSheet`/inline styles. No Tailwind/uniwind.
- Animations: keep them light (Reanimated `entering={FadeInDown}` etc. or none). Respect reduce motion where easy.

## Shared foundation (owned by the lead — read, don't rewrite; small additive exports are OK if you mention them)

- `src/theme/tokens.ts` — colours `C`, category tints `CAT`, `CATEGORIES`, fonts `F`, radii `R`.
- `src/components/ui.tsx` — `T` (text variants), `Screen`, `Header`, `Button`, `Chip`, `Pill`, `Card`,
  `PaceBubble`, `ReplyBubble`, `PaceMark`, `Ring`, `Bar`, `Icon`, `Keypad`.
- `src/domain/types.ts` — `Profile`, `Entry`, `PendingImport`…
- `src/domain/budget.ts` — the engine: `dayPlan(profile, entries, date?)`, `planTotals`, `projectedLimits`,
  `cycleFor`, `nextDue`, date helpers, `prettyDate`. Verified against the design sample (₹973 weekend / ₹608 weekday / ₹808 Wednesday).
- `src/domain/money.ts` — `fmt(value, currency, {decimals, sign})` (Indian grouping for INR), `currencyForCountry`.
- `src/store/index.ts` — `useStore(selector)`, `getState()`, `actions.{updateProfile, completeOnboarding, addEntry,
  updateEntry, deleteEntry, addPending, removePending, markShareHowToSeen, reset}`, `newId()`. Persisted on device.
- `src/features/reminders.ts` — contract `requestReminderPermission()`, `scheduleReminders(profile)`.
- Routing: `src/app/_layout.tsx` (root Stack), `src/app/index.tsx` (gate → `/onboarding/welcome` or `/(tabs)`),
  `src/app/(tabs)/_layout.tsx` (custom tab bar: Today, Activity, centre +Add → `/add-expense`, Plan, Insights),
  `src/app/+native-intent.ts` (shared content → `/share/handle`).

## Ownership (only edit files you own; create new non-route files under your `src/features/<area>/`)

| Agent | Routes (`src/app/…`) | Boards |
|---|---|---|
| onboarding | `onboarding/*.tsx` (welcome, how, hello, country, pay, income, milestone, bills, emi, routine, week, savings, start, building, summary, reminders, done) | Welcome, ObHow … ObDone |
| core | `(tabs)/index.tsx` Today, `(tabs)/activity.tsx`, `(tabs)/plan.tsx`, `(tabs)/insights.tsx`, `daily-detail.tsx`, `paywall.tsx`, `settings.tsx`, `entry/[id].tsx`; implement `src/features/reminders.ts` | Today, TodayOver, DailyDetail, Upcoming, Activity, Insights, Paywall |
| capture | `add-expense.tsx`, `import/scan.tsx`, `import/confirm.tsx`, `share/handle.tsx`, `share/duplicate.tsx`, `share/received.tsx`, `share/unread.tsx`, `share/how-to.tsx` | AddExpense, ImportScan, ImportConfirm, ShareQuick, ShareDup, ShareIncome, ShareUnread, ShareTeach |

## Cross-area contracts

- Onboarding order: welcome → how → hello → country → pay → income → milestone → bills → emi → routine → week → savings → start → building → summary → reminders → done → `actions.completeOnboarding()` then `router.replace('/(tabs)')`.
  Everything after `income` has a "Skip for now" (design). **Never show step counts or time left.**
- Onboarding writes the profile with `actions.updateProfile` as the user goes. `week` captures work days (incl. Saturday option) and day-wise extras (`dayExtras`, e.g. Wednesday +₹200 "Badminton").
- Today shows `store.pending.length` "shared screenshots waiting" → `router.push({ pathname: '/import/confirm', params: { pendingId } })`.
- Capture creates entries with `actions.addEntry({... source: 'share' | 'screenshot' | 'manual', countsToBudget: true })`.
- Activity rows → `/entry/[id]` (core owns the detail/edit/delete screen).
- `share/how-to` is reachable from Add expense ("From screenshot" area) and once after onboarding (core: show a one-time card on Today if `!seenShareHowTo` linking to `/share/how-to`).
- Settings (core) needs: currency/region display, edit plan entry points (can route to onboarding screens with `?edit=1`, onboarding agent: when `edit=1` param is present, Save returns `router.back()` instead of continuing), reminders toggles, "Delete all data" → `actions.reset()` + `router.replace('/')`.
- Currency: always format with `fmt(x, profile.currency)`.

## Done means

- `npx tsc --noEmit` passes for your files and `npx expo lint` shows no errors in your files.
- No placeholder screens left in your area; every button on your boards does something sensible.
- Report back: files created, any foundation additions, anything you couldn't do.
