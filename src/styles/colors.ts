export const colors = {
  // Brand
  primary: '#0ea5e9',     // sky-500
  primaryDark: '#0284c7', // sky-600
  primaryLight: '#bae6fd',// sky-200

  // Ratings
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',

  greenBg: '#f0fdf4',
  yellowBg: '#fefce8',
  redBg: '#fef2f2',

  // Neutrals
  white: '#ffffff',
  black: '#000000',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Ocean palette
  ocean100: '#e0f2fe',
  ocean500: '#0ea5e9',
  ocean700: '#0369a1',
  sand100: '#fef3c7',
  sand400: '#fbbf24',

  // Transparent overlays
  overlayLight: 'rgba(255,255,255,0.85)',
  overlayDark: 'rgba(0,0,0,0.5)',
} as const;

export type ColorKey = keyof typeof colors;
