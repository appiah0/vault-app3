// app/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, Modal, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../src/context';
import {
  lockVault, changeMasterPassword, storePinAndMaster,
  exportEncryptedBackup, importEncryptedBackup, nukeEverything,
} from '../src/storage';
import {
  ToggleRow, SectionHeader, Btn, Field,
  ConfirmDialog, Toast, LoadingOverlay
} from '../src/components/UI';
import { AUTO_LOCK_OPTIONS } from '../src/theme';

export default function SettingsScreen() {
  const { theme, settings, updateSettings, showToast, setLoading, vault, checkSetup } = useApp();
  const router = useRouter();

  const [biometricAvail, setBiometricAvail] = useState(false);

  // Change master password modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [changePwErr, setChangePwErr] = useState('');

  // Change PIN modal
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [changePinErr, setChangePinErr] = useState('');

  // Export modal
  const [showExport, setShowExport] = useState(false);
  const [exportPw, setExportPw] = useState('');
  const [exportPw2, setExportPw2] = useState('');
  const [exportErr, setExportErr] = useState('');

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importPw, setImportPw] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importErr, setImportErr] = useState('');

  // Nuke confirm
  const [showNuke, setShowNuke] = useState(false);

  // Auto-lock picker
  const [showAutoLock, setShowAutoLock] = useState(false);

  useEffect(() => {
    LocalAuthentication.hasHardwareAsync().then(h => {
      LocalAuthentication.isEnrolledAsync().then(e => setBiometricAvail(h && e));
    });
  }, []);

  // ── Screenshot blocking (Android FLAG_SECURE via note — no native module needed) ──
  function toggleScreenshot() {
    const next = !settings.screenshotBlocked;
    updateSettings({ screenshotBlocked: next });
    // FLAG_SECURE is set natively in MainActivity — inform user to rebuild for full effect
    showToast(
      next
        ? '📵 Screenshot blocking enabled (rebuil APK to fully apply)'
        : '📸 Screenshots allowed'
    );
  }

  // ── Biometric ──
  async function toggleBiometric() {
    if (!biometricAvail) {
      showToast('No biometric enrolled on this device', 'error');
      return;
    }
    const next = !settings.biometricEnabled;
    if (next) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to enable biometric unlock',
        cancelLabel: 'Cancel',
      });
      if (!result.success) return;
    }
    await updateSettings({ biometricEnabled: next });
    showToast(next ? '👆 Biometrics enabled' : 'Biometrics disabled');
  }

  // ── Change master password ──
  async function handleChangePw() {
    setChangePwErr('');
    if (!curPw || !newPw || !newPw2) { setChangePwErr('All fields required.'); return; }
    if (newPw.length < 10) { setChangePwErr('New password must be at least 10 characters.'); return; }
    if (newPw !== newPw2) { setChangePwErr('Passwords do not match.'); return; }
    setLoading(true, 'Re-encrypting vault…');
    try {
      const ok = await changeMasterPassword(curPw, newPw, newPin || '000000');
      if (!ok) { setChangePwErr('Current password is incorrect.'); setLoading(false); return; }
      setShowChangePw(false);
      setCurPw(''); setNewPw(''); setNewPw2('');
      showToast('✅ Master password updated', 'success');
    } catch {
      setChangePwErr('Failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Change PIN ──
  async function handleChangePin() {
    setChangePinErr('');
    if (!/^\d{6}$/.test(newPin)) { setChangePinErr('PIN must be exactly 6 digits.'); return; }
    if (newPin !== newPin2) { setChangePinErr('PINs do not match.'); return; }
    if (!curPw) { setChangePinErr('Enter current master password to verify.'); return; }
    setLoading(true, 'Updating PIN…');
    try {
      await storePinAndMaster(newPin, curPw);
      setShowChangePin(false);
      setNewPin(''); setNewPin2(''); setCurPw('');
      showToast('✅ PIN updated', 'success');
    } catch {
      setChangePinErr('Failed. Check your master password.');
    } finally {
      setLoading(false);
    }
  }

  // ── Export ──
  async function handleExport() {
    setExportErr('');
    if (!exportPw) { setExportErr('Backup password required.'); return; }
    if (exportPw !== exportPw2) { setExportErr('Passwords do not match.'); return; }
    setLoading(true, 'Encrypting backup…');
    try {
      const json = await exportEncryptedBackup(exportPw);
      const filename = `vault_backup_${new Date().toISOString().split('T')[0]}.json`;
      const path = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Save Vault Backup',
      });
      setShowExport(false);
      setExportPw(''); setExportPw2('');
      showToast('📤 Backup exported', 'success');
    } catch (e) {
      setExportErr('Export failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Import ──
  async function handleImport() {
    setImportErr('');
    if (!importPw) { setImportErr('Backup password required.'); return; }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setLoading(true, 'Decrypting backup…');
      const json = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await importEncryptedBackup(json, importPw, importMode);
      setShowImport(false);
      setImportPw('');
      showToast(`✅ Backup imported (${importMode})`, 'success');
    } catch {
      setImportErr('Wrong password or corrupted backup.');
    } finally {
      setLoading(false);
    }
  }

  // ── Nuke ──
  async function handleNuke() {
    setLoading(true, 'Wiping vault…');
    await nukeEverything();
    setLoading(false);
    await checkSetup();
    router.replace('/setup');
  }

  const autoLockLabel =
    AUTO_LOCK_OPTIONS.find(o => o.ms === settings.autoLockMs)?.label ?? 'Custom';

  function SettingRow({
    label, sub, value, onPress, arrow = true, danger = false,
  }: {
    label: string; sub?: string; value?: string;
    onPress: () => void; arrow?: boolean; danger?: boolean;
  }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingVertical: 14, paddingHorizontal: 16,
          borderBottomWidth: 1, borderBottomColor: theme.border,
        }}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={{
            color: danger ? theme.red : theme.text,
            fontSize: 15, fontWeight: '500',
          }}>
            {label}
          </Text>
          {sub && (
            <Text style={{ color: theme.text2, fontSize: 12, marginTop: 2 }}>{sub}</Text>
          )}
        </View>
        {value && (
          <Text style={{ color: theme.text2, fontSize: 14, marginRight: 6 }}>{value}</Text>
        )}
        {arrow && <Text style={{ color: theme.text3, fontSize: 18 }}>›</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{
        paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
        backgroundColor: theme.bg,
        borderBottomWidth: 1, borderBottomColor: theme.border,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: theme.accent, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Security ── */}
        <SectionHeader title="Security" />
        <View style={{
          backgroundColor: theme.card,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border,
        }}>
          <SettingRow label="Change Master Password" sub="Re-encrypts entire vault" onPress={() => setShowChangePw(true)} />
          <SettingRow label="Change PIN" sub="6-digit quick unlock" onPress={() => setShowChangePin(true)} />
          <SettingRow
            label="Auto-Lock"
            sub="Lock vault after inactivity"
            value={autoLockLabel}
            onPress={() => setShowAutoLock(true)}
          />
          <ToggleRow
            label="Block Screenshots"
            sub="Prevents screen capture (Android)"
            value={settings.screenshotBlocked}
            onToggle={toggleScreenshot}
          />
          {biometricAvail && (
            <ToggleRow
              label="Biometric Unlock"
              sub="Fingerprint / Face ID"
              value={settings.biometricEnabled}
              onToggle={toggleBiometric}
            />
          )}
        </View>

        {/* ── Appearance ── */}
        <SectionHeader title="Appearance" />
        <View style={{
          backgroundColor: theme.card,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border,
        }}>
          <SettingRow
            label="Theme"
            value={settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
            onPress={async () => {
              const next = settings.theme === 'dark' ? 'light' : 'dark';
              await updateSettings({ theme: next });
              showToast(`${next === 'dark' ? '🌙' : '☀️'} ${next.charAt(0).toUpperCase() + next.slice(1)} mode`);
            }}
          />
        </View>

        {/* ── Clipboard ── */}
        <SectionHeader title="Clipboard" />
        <View style={{
          backgroundColor: theme.card,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border,
        }}>
          <SettingRow
            label="Clear Clipboard After"
            sub="Auto-clear copied passwords"
            value={
              settings.clearClipboardMs === 0 ? 'Never'
              : settings.clearClipboardMs === 30000 ? '30 seconds'
              : settings.clearClipboardMs === 60000 ? '1 minute'
              : `${settings.clearClipboardMs / 1000}s`
            }
            onPress={() => {
              const next =
                settings.clearClipboardMs === 30000 ? 60000
                : settings.clearClipboardMs === 60000 ? 0
                : 30000;
              updateSettings({ clearClipboardMs: next });
              showToast(`Clipboard clears after: ${next === 0 ? 'Never' : next === 30000 ? '30s' : '1 min'}`);
            }}
          />
        </View>

        {/* ── Backup ── */}
        <SectionHeader title="Backup & Restore" />
        <View style={{
          backgroundColor: theme.card,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border,
        }}>
          <SettingRow
            label="Export Encrypted Backup"
            sub={`${vault.entries.length} entries · Protected by backup password`}
            onPress={() => setShowExport(true)}
          />
          <SettingRow
            label="Import Backup"
            sub="Merge or replace existing vault"
            onPress={() => setShowImport(true)}
          />
        </View>

        {/* ── About ── */}
        <SectionHeader title="About" />
        <View style={{
          backgroundColor: theme.card,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border,
        }}>
          <View style={{ padding: 16 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>Vault v1.0.0</Text>
            <Text style={{ color: theme.text2, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
              AES-256-GCM · PBKDF2 · 200,000 iterations{'\n'}
              Zero-knowledge · All data stored on device only{'\n'}
              Passwords never sent to any server
            </Text>
          </View>
        </View>

        {/* ── Danger ── */}
        <SectionHeader title="Danger Zone" />
        <View style={{
          backgroundColor: theme.card,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.border,
        }}>
          <SettingRow
            label="Delete All Data"
            sub="Permanently wipe vault — cannot be undone"
            onPress={() => setShowNuke(true)}
            arrow={false}
            danger
          />
        </View>

        {/* Lock button */}
        <View style={{ padding: 20 }}>
          <Btn
            label="🔒 Lock Vault"
            onPress={() => { lockVault(); router.replace('/lock'); }}
            variant="secondary"
          />
        </View>

      </ScrollView>

      {/* ── Change Master Password Modal ── */}
      <Modal visible={showChangePw} animationType="slide" transparent onRequestClose={() => setShowChangePw(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme.bg2,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40,
          }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 20 }}>
              Change Master Password
            </Text>
            <Field label="Current Password" value={curPw} onChangeText={setCurPw} secret placeholder="Current master password" />
            <Field label="New Password (min 10 chars)" value={newPw} onChangeText={setNewPw} secret placeholder="New master password" />
            <Field label="Confirm New Password" value={newPw2} onChangeText={setNewPw2} secret placeholder="Repeat new password" />
            {changePwErr ? (
              <Text style={{ color: theme.red, marginBottom: 12, fontSize: 13 }}>{changePwErr}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Btn label="Cancel" variant="ghost" style={{ flex: 1 }}
                onPress={() => { setShowChangePw(false); setCurPw(''); setNewPw(''); setNewPw2(''); setChangePwErr(''); }} />
              <Btn label="Update" style={{ flex: 2 }} onPress={handleChangePw} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change PIN Modal ── */}
      <Modal visible={showChangePin} animationType="slide" transparent onRequestClose={() => setShowChangePin(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme.bg2,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40,
          }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 20 }}>
              Change PIN
            </Text>
            <Field label="Master Password (to verify)" value={curPw} onChangeText={setCurPw} secret placeholder="Master password" />
            <Field label="New 6-Digit PIN" value={newPin} onChangeText={setNewPin} placeholder="New PIN" keyboardType="numeric" maxLength={6} />
            <Field label="Confirm New PIN" value={newPin2} onChangeText={setNewPin2} placeholder="Repeat PIN" keyboardType="numeric" maxLength={6} />
            {changePinErr ? (
              <Text style={{ color: theme.red, marginBottom: 12, fontSize: 13 }}>{changePinErr}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Btn label="Cancel" variant="ghost" style={{ flex: 1 }}
                onPress={() => { setShowChangePin(false); setNewPin(''); setNewPin2(''); setChangePinErr(''); }} />
              <Btn label="Update" style={{ flex: 2 }} onPress={handleChangePin} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Export Modal ── */}
      <Modal visible={showExport} animationType="slide" transparent onRequestClose={() => setShowExport(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme.bg2,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40,
          }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>
              Export Encrypted Backup
            </Text>
            <Text style={{ color: theme.text2, fontSize: 13, marginBottom: 20, lineHeight: 20 }}>
              Vault will be encrypted with a separate backup password. Store the file and password safely.
            </Text>
            <Field label="Backup Password" value={exportPw} onChangeText={setExportPw} secret placeholder="Choose a strong backup password" />
            <Field label="Confirm Backup Password" value={exportPw2} onChangeText={setExportPw2} secret placeholder="Repeat backup password" />
            {exportErr ? (
              <Text style={{ color: theme.red, marginBottom: 12, fontSize: 13 }}>{exportErr}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Btn label="Cancel" variant="ghost" style={{ flex: 1 }}
                onPress={() => { setShowExport(false); setExportPw(''); setExportPw2(''); setExportErr(''); }} />
              <Btn label="Export" style={{ flex: 2 }} onPress={handleExport} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Import Modal ── */}
      <Modal visible={showImport} animationType="slide" transparent onRequestClose={() => setShowImport(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme.bg2,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40,
          }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>
              Import Backup
            </Text>
            <Field label="Backup Password" value={importPw} onChangeText={setImportPw} secret placeholder="Backup file password" />
            <Text style={{
              color: theme.text3, fontSize: 11, fontWeight: '700',
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
            }}>
              Import Mode
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {(['merge', 'replace'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setImportMode(m)}
                  style={{
                    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
                    borderWidth: 2,
                    borderColor: importMode === m ? theme.accent : theme.border,
                    backgroundColor: importMode === m ? theme.accentSoft : theme.bg3,
                  }}
                >
                  <Text style={{ color: importMode === m ? theme.accent : theme.text2, fontWeight: '700' }}>
                    {m === 'merge' ? '🔀 Merge' : '🔄 Replace'}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                    {m === 'merge' ? 'Keep existing + add new' : 'Replace everything'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {importErr ? (
              <Text style={{ color: theme.red, marginBottom: 12, fontSize: 13 }}>{importErr}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Btn label="Cancel" variant="ghost" style={{ flex: 1 }}
                onPress={() => { setShowImport(false); setImportPw(''); setImportErr(''); }} />
              <Btn label="Choose File" style={{ flex: 2 }} onPress={handleImport} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Auto-lock picker ── */}
      <Modal visible={showAutoLock} animationType="slide" transparent onRequestClose={() => setShowAutoLock(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme.bg2,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 40,
          }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Auto-Lock Timer</Text>
            </View>
            {AUTO_LOCK_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.ms}
                onPress={async () => {
                  await updateSettings({ autoLockMs: opt.ms });
                  setShowAutoLock(false);
                  showToast(`⏱ Auto-lock: ${opt.label}`);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 16, paddingHorizontal: 20,
                  borderBottomWidth: 1, borderBottomColor: theme.border,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{opt.label}</Text>
                {settings.autoLockMs === opt.ms && (
                  <Text style={{ color: theme.accent, fontSize: 20 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowAutoLock(false)}
              style={{ padding: 18, alignItems: 'center' }}
            >
              <Text style={{ color: theme.text2, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Nuke confirm ── */}
      <ConfirmDialog
        visible={showNuke}
        title="Delete All Data?"
        body="This will permanently wipe your entire vault, master password, and all settings. This CANNOT be undone."
        confirmLabel="Delete Everything"
        onConfirm={() => { setShowNuke(false); handleNuke(); }}
        onCancel={() => setShowNuke(false)}
      />

      <Toast />
      <LoadingOverlay />
    </View>
  );
}
