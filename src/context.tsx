// src/context.tsx
import React, {
  createContext, useContext, useState,
  useCallback, useEffect, useRef, ReactNode
} from 'react';
import * as Clipboard from 'expo-clipboard';
import { AppState, AppStateStatus } from 'react-native';
import {
  isSetupDone, isUnlocked, lockVault, getVault, saveVault,
  loadSettings, saveSettings, AppSettings, DEFAULT_SETTINGS,
  clearFailedAttempts
} from './storage';
import { VaultData, VaultEntry, VaultFolder } from './types';
import { getTheme, Theme } from './theme';

// ─── Context type ────────────────────────────────────────────────────────────

interface AppContextType {
  // Auth state
  setupDone: boolean;
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
  checkSetup: () => Promise<void>;

  // Vault
  vault: VaultData;
  refreshVault: () => void;
  saveAndRefresh: () => Promise<void>;

  // Settings
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;

  // Theme
  theme: Theme;
  isDark: boolean;

  // Clipboard
  copyToClipboard: (text: string, label?: string) => void;

  // Toast
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  toast: { msg: string; type: string } | null;

  // Loading
  setLoading: (v: boolean, text?: string) => void;
  loading: boolean;
  loadingText: string;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: ReactNode }) {
  const [setupDone, setSetupDone] = useState(false);
  const [unlocked, setUnlockedState] = useState(false);
  const [vault, setVaultState] = useState<VaultData>(getVault());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoadingState] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init ──
  useEffect(() => {
    checkSetup();
    loadSettings().then(s => setSettings(s));
  }, []);

  // ── App state → auto lock ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        scheduleAutoLock();
      } else if (state === 'active') {
        clearAutoLock();
      }
    });
    return () => sub.remove();
  }, [settings.autoLockMs, unlocked]);

  function scheduleAutoLock() {
    clearAutoLock();
    if (!unlocked || settings.autoLockMs === 0) return;
    autoLockTimer.current = setTimeout(() => {
      lockVault();
      setUnlockedState(false);
    }, settings.autoLockMs);
  }

  function clearAutoLock() {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
  }

  // ── Auth ──
  async function checkSetup() {
    const done = await isSetupDone();
    setSetupDone(done);
    setUnlockedState(isUnlocked());
  }

  function setUnlocked(v: boolean) {
    setUnlockedState(v);
    if (v) {
      refreshVault();
      clearFailedAttempts();
    }
  }

  // ── Vault ──
  function refreshVault() {
    setVaultState({ ...getVault() });
  }

  async function saveAndRefresh() {
    await saveVault();
    refreshVault();
  }

  // ── Settings ──
  async function updateSettings(partial: Partial<AppSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveSettings(next);
  }

  // ── Theme ──
  const resolvedTheme = settings.theme === 'system'
    ? 'dark' // fallback; real system check done in component
    : settings.theme;
  const theme = getTheme(resolvedTheme as 'dark' | 'light');
  const isDark = resolvedTheme === 'dark';

  // ── Clipboard ──
  function copyToClipboard(text: string, label = 'Copied') {
    Clipboard.setStringAsync(text);
    showToast(`📋 ${label}`, 'success');
    if (settings.clearClipboardMs > 0) {
      if (clipTimer.current) clearTimeout(clipTimer.current);
      clipTimer.current = setTimeout(() => {
        Clipboard.setStringAsync('');
      }, settings.clearClipboardMs);
    }
  }

  // ── Toast ──
  function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  // ── Loading ──
  function setLoading(v: boolean, text = 'Processing…') {
    setLoadingState(v);
    setLoadingText(text);
  }

  return (
    <AppContext.Provider value={{
      setupDone, unlocked, setUnlocked, checkSetup,
      vault, refreshVault, saveAndRefresh,
      settings, updateSettings,
      theme, isDark,
      copyToClipboard,
      showToast, toast,
      setLoading, loading, loadingText,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
