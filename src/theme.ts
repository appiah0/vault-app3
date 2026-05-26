// src/theme.ts

export const dark = {
  bg: '#0d0d14',
  bg2: '#13131f',
  bg3: '#1a1a2e',
  bg4: '#22223a',
  border: '#2a2a44',
  border2: '#3a3a58',
  accent: '#6366f1',
  accentSoft: 'rgba(99,102,241,0.15)',
  accent2: '#a78bfa',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  blue: '#38bdf8',
  text: '#f0f0fa',
  text2: '#9090b8',
  text3: '#55556a',
  card: '#13131f',
  cardBorder: '#2a2a44',
};

export const light = {
  bg: '#f5f5ff',
  bg2: '#ffffff',
  bg3: '#ebebf8',
  bg4: '#e0e0f0',
  border: '#dcdcf0',
  border2: '#c8c8e8',
  accent: '#5B4FE8',
  accentSoft: 'rgba(91,79,232,0.12)',
  accent2: '#7c6ff0',
  green: '#16a34a',
  red: '#dc2626',
  yellow: '#ca8a04',
  blue: '#0284c7',
  text: '#0f0f1a',
  text2: '#5c5c78',
  text3: '#9090a8',
  card: '#ffffff',
  cardBorder: '#dcdcf0',
};

export type Theme = typeof dark;

export function getTheme(mode: 'dark' | 'light'): Theme {
  return mode === 'dark' ? dark : light;
}

export const ENTRY_TYPE_META = {
  Login: { icon: '🔑', label: 'Login', color: '#6366f1' },
  Card:  { icon: '💳', label: 'Card',  color: '#ec4899' },
  WiFi:  { icon: '📶', label: 'Wi-Fi', color: '#22c55e' },
  Note:  { icon: '📝', label: 'Note',  color: '#eab308' },
  Other: { icon: '📦', label: 'Other', color: '#8b5cf6' },
} as const;

export const AUTO_LOCK_OPTIONS = [
  { label: '15 seconds', ms: 15_000 },
  { label: '30 seconds', ms: 30_000 },
  { label: '1 minute',   ms: 60_000 },
  { label: '5 minutes',  ms: 5 * 60_000 },
  { label: '10 minutes', ms: 10 * 60_000 },
  { label: '30 minutes', ms: 30 * 60_000 },
  { label: '1 hour',     ms: 60 * 60_000 },
  { label: 'Never',      ms: 0 },
];
