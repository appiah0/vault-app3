// src/types.ts

export type EntryType = 'Login' | 'Card' | 'WiFi' | 'Note' | 'Other';

export interface PasswordHistory {
  password: string;
  changedAt: number;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64
}

export interface VaultEntry {
  id: string;
  type: EntryType;
  title: string;
  folderId?: string;
  tags: string[];
  favourite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  expiresAt?: number;

  // Login fields
  username?: string;
  password?: string;
  url?: string;
  totp?: string; // Base32 secret

  // Card fields
  cardholderName?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
  pin?: string;

  // WiFi fields
  ssid?: string;
  wifiPassword?: string;
  security?: string;

  // Note
  note?: string;

  // Password history (last 10)
  passwordHistory?: PasswordHistory[];

  // Attachments
  attachments?: Attachment[];

  // Custom fields
  customFields?: { label: string; value: string; hidden: boolean }[];
}

export interface VaultFolder {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface VaultData {
  version: number;
  entries: VaultEntry[];
  folders: VaultFolder[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_FOLDERS: VaultFolder[] = [
  { id: 'work', name: 'Work', icon: '💼', color: '#6366f1' },
  { id: 'personal', name: 'Personal', icon: '🏠', color: '#22c55e' },
  { id: 'banking', name: 'Banking', icon: '🏦', color: '#eab308' },
  { id: 'social', name: 'Social', icon: '💬', color: '#ec4899' },
];

export function makeEntry(partial: Partial<VaultEntry>): VaultEntry {
  const now = Date.now();
  return {
    id: `e_${now}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'Login',
    title: '',
    tags: [],
    favourite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    passwordHistory: [],
    attachments: [],
    customFields: [],
    ...partial,
  };
}

export function emptyVault(): VaultData {
  return {
    version: 1,
    entries: [],
    folders: [...DEFAULT_FOLDERS],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
