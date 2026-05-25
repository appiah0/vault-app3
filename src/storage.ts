// src/storage.ts
// All sensitive data goes through expo-secure-store (hardware-backed on Android)
// Vault blob is encrypted with AES-256-GCM before storing

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deriveKey, encryptData, decryptData,
  generateSalt, saltFromB64, hashPin
} from './crypto';
import { VaultData, emptyVault } from './types';

// SecureStore keys
const KEY_SALT        = 'vault_salt';
const KEY_PIN_HASH    = 'vault_pin_hash';
const KEY_PIN_SALT    = 'vault_pin_salt';
// We store the master password encrypted with a PIN-derived key so PIN unlock works
const KEY_ENC_MASTER  = 'vault_enc_master';
const KEY_ENC_MASTER_SALT = 'vault_enc_master_salt';
// Vault blob goes to AsyncStorage (can be large)
const KEY_VAULT_BLOB  = 'vault_blob';
// Settings
const KEY_SETTINGS    = 'vault_settings';

// ─── In-memory session state ────────────────────────────────────────────────

let _sessionKey: CryptoKey | null = null;
let _vault: VaultData | null = null;
let _salt: string | null = null;

export function isUnlocked(): boolean { return _sessionKey !== null; }
export function getVault(): VaultData { return _vault ?? emptyVault(); }
export function setVault(v: VaultData) { _vault = v; }

// ─── Setup ──────────────────────────────────────────────────────────────────

export async function setupVault(masterPassword: string, pin: string): Promise<void> {
  // 1. Generate salt for master key
  const salt = await generateSalt();
  _salt = salt;
  await SecureStore.setItemAsync(KEY_SALT, salt);

  // 2. Derive master key
  const key = await deriveKey(masterPassword, saltFromB64(salt));
  _sessionKey = key;

  // 3. Encrypt empty vault
  _vault = emptyVault();
  await _saveVaultBlob();

  // 4. Store PIN (hashed)
  await storePinAndMaster(pin, masterPassword);
}

export async function storePinAndMaster(pin: string, masterPassword: string): Promise<void> {
  // Hash PIN for verification
  const pinSalt = await generateSalt();
  const pinHash = await hashPin(pin, pinSalt);
  await SecureStore.setItemAsync(KEY_PIN_SALT, pinSalt);
  await SecureStore.setItemAsync(KEY_PIN_HASH, pinHash);

  // Encrypt master password with PIN-derived key (so PIN can unlock)
  const pinKey = await deriveKey(pin + '_master_enc', saltFromB64(pinSalt));
  const encMaster = await encryptData(pinKey, masterPassword);
  const encMasterSalt = await generateSalt(); // unused but keep for future
  await SecureStore.setItemAsync(KEY_ENC_MASTER, encMaster);
  await SecureStore.setItemAsync(KEY_ENC_MASTER_SALT, encMasterSalt);
}

// ─── Unlock ─────────────────────────────────────────────────────────────────

export async function unlockWithMaster(masterPassword: string): Promise<boolean> {
  try {
    const salt = await SecureStore.getItemAsync(KEY_SALT);
    if (!salt) return false;
    _salt = salt;
    const key = await deriveKey(masterPassword, saltFromB64(salt));
    // Try decrypting vault to verify password
    const blob = await AsyncStorage.getItem(KEY_VAULT_BLOB);
    if (!blob) {
      // Empty vault (first time after setup)
      _sessionKey = key;
      _vault = emptyVault();
      return true;
    }
    const vault = await decryptData<VaultData>(key, blob);
    _sessionKey = key;
    _vault = vault;
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithPin(pin: string): Promise<boolean> {
  try {
    const pinSalt = await SecureStore.getItemAsync(KEY_PIN_SALT);
    const storedHash = await SecureStore.getItemAsync(KEY_PIN_HASH);
    if (!pinSalt || !storedHash) return false;

    const pinHash = await hashPin(pin, pinSalt);
    if (pinHash !== storedHash) return false;

    // Decrypt master password using PIN
    const encMaster = await SecureStore.getItemAsync(KEY_ENC_MASTER);
    if (!encMaster) return false;

    const pinKey = await deriveKey(pin + '_master_enc', saltFromB64(pinSalt));
    const masterPassword = await decryptData<string>(pinKey, encMaster);

    return unlockWithMaster(masterPassword);
  } catch {
    return false;
  }
}

export function lockVault(): void {
  _sessionKey = null;
  _vault = null;
  _salt = null;
}

// ─── Persistence ────────────────────────────────────────────────────────────

async function _saveVaultBlob(): Promise<void> {
  if (!_sessionKey || !_vault) throw new Error('Vault not unlocked');
  _vault.updatedAt = Date.now();
  const blob = await encryptData(_sessionKey, _vault);
  await AsyncStorage.setItem(KEY_VAULT_BLOB, blob);
}

export async function saveVault(): Promise<void> {
  await _saveVaultBlob();
}

// ─── Check if setup done ─────────────────────────────────────────────────────

export async function isSetupDone(): Promise<boolean> {
  const salt = await SecureStore.getItemAsync(KEY_SALT);
  return salt !== null;
}

// ─── Change master password ──────────────────────────────────────────────────

export async function changeMasterPassword(
  currentPw: string,
  newPw: string,
  pin: string
): Promise<boolean> {
  try {
    const ok = await unlockWithMaster(currentPw);
    if (!ok) return false;
    // Generate new salt
    const newSalt = await generateSalt();
    _salt = newSalt;
    await SecureStore.setItemAsync(KEY_SALT, newSalt);
    const newKey = await deriveKey(newPw, saltFromB64(newSalt));
    _sessionKey = newKey;
    await _saveVaultBlob();
    await storePinAndMaster(pin, newPw);
    return true;
  } catch {
    return false;
  }
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export async function exportEncryptedBackup(backupPassword: string): Promise<string> {
  if (!_vault) throw new Error('Vault not unlocked');
  const salt = await generateSalt();
  const key = await deriveKey(backupPassword, saltFromB64(salt));
  const blob = await encryptData(key, _vault);
  const backup = { version: 1, salt, data: blob, exportedAt: Date.now() };
  return JSON.stringify(backup);
}

export async function importEncryptedBackup(
  json: string,
  backupPassword: string,
  mode: 'merge' | 'replace'
): Promise<void> {
  const backup = JSON.parse(json);
  const key = await deriveKey(backupPassword, saltFromB64(backup.salt));
  const imported = await decryptData<VaultData>(key, backup.data);

  if (mode === 'replace') {
    _vault = imported;
  } else {
    // Merge: add entries that don't exist by id
    const currentIds = new Set((_vault?.entries ?? []).map(e => e.id));
    const newEntries = (imported.entries ?? []).filter(e => !currentIds.has(e.id));
    if (_vault) {
      _vault.entries = [..._vault.entries, ...newEntries];
    }
  }
  await _saveVaultBlob();
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  autoLockMs: number;   // milliseconds, 0 = never
  clearClipboardMs: number; // 0 = never
  screenshotBlocked: boolean;
  biometricEnabled: boolean;
  failedAttempts: number;
  lockedUntil: number; // timestamp
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  autoLockMs: 5 * 60 * 1000,  // 5 min
  clearClipboardMs: 30 * 1000, // 30s
  screenshotBlocked: false,
  biometricEnabled: false,
  failedAttempts: 0,
  lockedUntil: 0,
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
}

export async function recordFailedAttempt(): Promise<AppSettings> {
  const s = await loadSettings();
  s.failedAttempts += 1;
  // Lockout schedule: 5 failures = 5min, 10 = 30min, 15 = 1day
  if (s.failedAttempts >= 15) {
    s.lockedUntil = Date.now() + 24 * 60 * 60 * 1000;
  } else if (s.failedAttempts >= 10) {
    s.lockedUntil = Date.now() + 30 * 60 * 1000;
  } else if (s.failedAttempts >= 5) {
    s.lockedUntil = Date.now() + 5 * 60 * 1000;
  }
  await saveSettings(s);
  return s;
}

export async function clearFailedAttempts(): Promise<void> {
  const s = await loadSettings();
  s.failedAttempts = 0;
  s.lockedUntil = 0;
  await saveSettings(s);
}

export async function nukeEverything(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_SALT).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_PIN_HASH).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_PIN_SALT).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_ENC_MASTER).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_ENC_MASTER_SALT).catch(() => {});
  await AsyncStorage.removeItem(KEY_VAULT_BLOB).catch(() => {});
  await AsyncStorage.removeItem(KEY_SETTINGS).catch(() => {});
  lockVault();
}
