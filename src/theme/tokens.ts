// Pace design tokens — mirror the approved design canvas (Design system board).
export const C = {
  harbor: '#0E3C47', // primary ink / dark surfaces
  harborMid: '#155060',
  harborLine: '#24606F',
  harborSoft: '#3C7381',
  mint: '#6EE0AE', // positive accent
  mintSoft: '#D6F3E5',
  paper: '#F7F5F0', // app background
  white: '#FFFFFF',
  line: '#E5E1D8',
  lineSoft: '#EFEBE3',
  chipLine: '#DCD7CB',
  btnLine: '#CFC9BC',
  sand: '#EAE6DD',
  ink: '#0E3C47',
  inkMuted: '#4D5F63',
  inkFaint: '#6C7C80',
  inkDisabled: '#A5B2B4',
  onDark: '#EEF6F5',
  onDarkMuted: '#A9C6CC',
  link: '#0F6577',
  linkSoft: '#E6F1F2',
  ok: '#1F7A4D',
  okSoft: '#E3F3EA',
  coral: '#FF9877',
  coralSoft: '#FDE9E2',
  coralInk: '#B4401F',
  amberSoft: '#FFF1D6',
  amber: '#8A5100',
  amberInk: '#4A2C00',
  gold: '#E8B04B',
  success: '#2E9E5B',
} as const;

// Category tints used in lists (bg / fg pairs)
export const CAT: Record<string, { bg: string; fg: string; i: string }> = {
  Food: { bg: '#FCE9DA', fg: '#9A4512', i: 'FD' },
  Transport: { bg: '#E1E9FB', fg: '#2148A8', i: 'TR' },
  Groceries: { bg: '#E3F3EA', fg: '#1F7A4D', i: 'GR' },
  Shopping: { bg: '#EEF0D6', fg: '#5A6118', i: 'SH' },
  Fun: { bg: '#F8E1EB', fg: '#8E2752', i: 'FN' },
  Health: { bg: '#E6F1F2', fg: '#0F6577', i: 'HL' },
  Bills: { bg: '#FFF1D6', fg: '#8A5100', i: 'BL' },
  Other: { bg: '#EFEBE3', fg: '#4D5F63', i: 'OT' },
};
export const CATEGORIES = ['Food', 'Transport', 'Groceries', 'Shopping', 'Fun', 'Health', 'Other'] as const;

export const F = {
  // loaded in src/app/_layout.tsx
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
  displayMed: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const R = { sm: 10, md: 16, lg: 20, xl: 28, pill: 999 } as const;
export const S = { gutter: 20 } as const;
