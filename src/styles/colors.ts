export const colors = {
  // ── Brand ─────────────────────────────────────────────────────────────────
  primary:      '#d59563',    // golden amber — echoes Google Maps night label colour
  primaryDark:  '#c4834e',    // darker amber (pressed / focused state)
  primaryLight: '#3d2a14',    // very dark warm tint (subtle highlight / active bg)

  // ── Condition ratings ─────────────────────────────────────────────────────
  green:   '#22c55e',
  yellow:  '#eab308',
  red:     '#ef4444',

  greenBg:  '#14532d',        // dark green surface
  yellowBg: '#713f12',        // dark amber surface
  redBg:    '#7f1d1d',        // dark red surface

  // ── Neutrals (dark-first: gray50 = darkest bg, gray900 = brightest text) ──
  white:   '#ffffff',         // true white — kept for text on coloured buttons etc.
  black:   '#0a1520',         // deep navy-black — shadows
  gray50:  '#0f1a26',         // page background (deepest)
  gray100: '#172030',         // card / sheet surface
  gray200: '#1f2d42',         // elevated surface / input background
  gray300: '#28394f',         // borders, dividers, handle indicator
  gray400: '#4a6070',         // disabled / very subtle text
  gray500: '#6b8090',         // placeholder, tertiary text
  gray600: '#8da0ae',         // secondary text
  gray700: '#afc0cb',         // body text
  gray800: '#d0dce6',         // secondary headings
  gray900: '#e8f0f6',         // primary text (brightest)

  // ── Ocean / Sand (remapped to dark-map tones) ─────────────────────────────
  ocean100: '#17263c',        // deep navy — map water colour
  ocean500: '#1e3352',        // mid navy
  ocean700: '#243d63',        // deep blue accent
  sand100:  '#2a3548',        // dark warm surface (chip / tag bg)
  sand400:  '#d59563',        // golden amber (same as primary)

  // ── Overlays ──────────────────────────────────────────────────────────────
  overlayLight: 'rgba(255,255,255,0.06)',  // subtle shimmer on dark surfaces
  overlayDark:  'rgba(0,0,0,0.65)',        // dark scrim
} as const;

export type ColorKey = keyof typeof colors;
