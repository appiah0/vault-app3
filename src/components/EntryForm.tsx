// src/components/EntryForm.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context';
import { VaultEntry, EntryType, makeEntry } from '../types';
import { getVault } from '../storage';
import { Field, StrengthBar, Btn, Toast, LoadingOverlay } from './UI';
import { ENTRY_TYPE_META } from '../theme';
import { measureStrength } from '../crypto';
import { generatePassword } from '../generator';

interface Props {
  mode: 'new' | 'edit';
  entryId?: string;
}

const TYPE_OPTIONS: EntryType[] = ['Login', 'Card', 'WiFi', 'Note', 'Other'];

export default function EntryForm({ mode, entryId }: Props) {
  const { theme, vault, saveAndRefresh, showToast } = useApp();
  const router = useRouter();

  // Load existing entry for edit
  const existing = entryId ? vault.entries.find(e => e.id === entryId) : null;

  // Form state
  const [type, setType] = useState<EntryType>(existing?.type ?? 'Login');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState(existing?.password ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [totp, setTotp] = useState(existing?.totp ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [tags, setTags] = useState(existing?.tags?.join(', ') ?? '');
  const [folderId, setFolderId] = useState(existing?.folderId ?? '');
  const [expiresAt, setExpiresAt] = useState<string>(
    existing?.expiresAt ? new Date(existing.expiresAt).toISOString().split('T')[0] : ''
  );
  // Card
  const [cardName, setCardName] = useState(existing?.cardholderName ?? '');
  const [cardNumber, setCardNumber] = useState(existing?.cardNumber ?? '');
  const [expiry, setExpiry] = useState(existing?.expiry ?? '');
  const [cvv, setCvv] = useState(existing?.cvv ?? '');
  const [cardPin, setCardPin] = useState(existing?.pin ?? '');
  // WiFi
  const [ssid, setSsid] = useState(existing?.ssid ?? '');
  const [wifiSecurity, setWifiSecurity] = useState(existing?.security ?? 'WPA2');
  const [wifiPw, setWifiPw] = useState(existing?.wifiPassword ?? '');
  // Custom fields
  const [customFields, setCustomFields] = useState(existing?.customFields ?? []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (type === 'Login' && password && measureStrength(password).score === 0) {
      e.password = 'Password is too weak';
    }
    // Duplicate name check
    const v = getVault();
    const dupe = v.entries.find(en =>
      en.title.toLowerCase() === title.trim().toLowerCase() &&
      en.id !== existing?.id
    );
    if (dupe) e.title = 'An entry with this name already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const v = getVault();
      const now = Date.now();
      const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);

      if (mode === 'new') {
        const entry = makeEntry({
          type, title: title.trim(), username, password, url, totp,
          note, tags: parsedTags, folderId: folderId || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
          cardholderName: cardName, cardNumber, expiry, cvv, pin: cardPin,
          ssid, security: wifiSecurity, wifiPassword: wifiPw,
          customFields,
        });
        v.entries.unshift(entry);
      } else if (existing) {
        const idx = v.entries.findIndex(e => e.id === existing.id);
        if (idx !== -1) {
          const prev = v.entries[idx];
          // Password history
          const history = [...(prev.passwordHistory ?? [])];
          if (prev.password && prev.password !== password) {
            history.unshift({ password: prev.password, changedAt: now });
            if (history.length > 10) history.pop();
          }
          v.entries[idx] = {
            ...prev,
            type, title: title.trim(), username, password, url, totp,
            note, tags: parsedTags, folderId: folderId || undefined,
            expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
            cardholderName: cardName, cardNumber, expiry, cvv, pin: cardPin,
            ssid, security: wifiSecurity, wifiPassword: wifiPw,
            customFields, passwordHistory: history,
            updatedAt: now,
          };
        }
      }
      await saveAndRefresh();
      showToast(mode === 'new' ? '✅ Entry added' : '✅ Entry updated', 'success');
      router.back();
    } catch (e) {
      showToast('Save failed. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function addCustomField() {
    setCustomFields([...customFields, { label: '', value: '', hidden: false }]);
  }

  function updateCustomField(i: number, field: Partial<typeof customFields[0]>) {
    const next = [...customFields];
    next[i] = { ...next[i], ...field };
    setCustomFields(next);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', flex: 1 }}>
          {mode === 'new' ? 'New Entry' : 'Edit Entry'}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: theme.accent, borderRadius: 10,
            paddingHorizontal: 16, paddingVertical: 8,
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Entry type picker */}
        <Text style={{ color: theme.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          Entry Type
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {TYPE_OPTIONS.map(t => {
            const meta = ENTRY_TYPE_META[t];
            const active = type === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={{
                  flex: 1, alignItems: 'center', padding: 10,
                  borderRadius: 12, borderWidth: 2,
                  borderColor: active ? meta.color : theme.border,
                  backgroundColor: active ? meta.color + '20' : theme.bg3,
                }}
              >
                <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
                <Text style={{
                  color: active ? meta.color : theme.text2,
                  fontSize: 10, fontWeight: '700', marginTop: 4,
                }}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Title */}
        <Field
          label="Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Gmail, Netflix"
          error={errors.title}
        />

        {/* ── LOGIN ── */}
        {type === 'Login' && (
          <>
            <Field label="Username / Email" value={username} onChangeText={setUsername} placeholder="you@example.com" keyboardType="email-address" />
            <View>
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secret
                error={errors.password}
                rightIcon={<Text style={{ fontSize: 16 }}>⚡</Text>}
                onRightIcon={() => setPassword(generatePassword())}
              />
              {password.length > 0 && <StrengthBar password={password} />}
            </View>
            <Field label="Website URL" value={url} onChangeText={setUrl} placeholder="https://example.com" keyboardType="url" />
            <Field label="TOTP Secret (for 2FA)" value={totp} onChangeText={setTotp} placeholder="Base32 secret" />
          </>
        )}

        {/* ── CARD ── */}
        {type === 'Card' && (
          <>
            <Field label="Cardholder Name" value={cardName} onChangeText={setCardName} placeholder="John Doe" />
            <Field label="Card Number" value={cardNumber} onChangeText={setCardNumber} placeholder="1234 5678 9012 3456" keyboardType="numeric" secret />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Expiry" value={expiry} onChangeText={setExpiry} placeholder="MM/YY" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="CVV" value={cvv} onChangeText={setCvv} placeholder="123" keyboardType="numeric" secret />
              </View>
            </View>
            <Field label="Card PIN" value={cardPin} onChangeText={setCardPin} placeholder="PIN" keyboardType="numeric" secret />
          </>
        )}

        {/* ── WIFI ── */}
        {type === 'WiFi' && (
          <>
            <Field label="Network Name (SSID)" value={ssid} onChangeText={setSsid} placeholder="MyHomeNetwork" />
            <Text style={{ color: theme.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
              Security Type
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['WPA2', 'WPA3', 'WEP', 'None'].map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setWifiSecurity(s)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderRadius: 20, borderWidth: 1,
                    borderColor: wifiSecurity === s ? theme.accent : theme.border,
                    backgroundColor: wifiSecurity === s ? theme.accentSoft : theme.bg3,
                  }}
                >
                  <Text style={{ color: wifiSecurity === s ? theme.accent : theme.text2, fontWeight: '600', fontSize: 13 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Wi-Fi Password" value={wifiPw} onChangeText={setWifiPw} placeholder="Network password" secret />
          </>
        )}

        {/* ── NOTE ── */}
        {type === 'Note' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: theme.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Secure Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Write your secure note here…"
              placeholderTextColor={theme.text3}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              style={{
                backgroundColor: theme.bg3, borderRadius: 10,
                borderWidth: 1, borderColor: theme.border,
                padding: 14, color: theme.text, fontSize: 14,
                minHeight: 160, lineHeight: 22,
              }}
            />
          </View>
        )}

        {/* ── OTHER: note field ── */}
        {(type === 'Login' || type === 'Card' || type === 'WiFi' || type === 'Other') && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: theme.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Notes (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Additional notes…"
              placeholderTextColor={theme.text3}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: theme.bg3, borderRadius: 10,
                borderWidth: 1, borderColor: theme.border,
                padding: 14, color: theme.text, fontSize: 14, minHeight: 80,
              }}
            />
          </View>
        )}

        {/* ── Folder ── */}
        <Text style={{ color: theme.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          Folder
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setFolderId('')}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                borderWidth: 1,
                borderColor: !folderId ? theme.accent : theme.border,
                backgroundColor: !folderId ? theme.accentSoft : theme.bg3,
              }}
            >
              <Text style={{ color: !folderId ? theme.accent : theme.text2, fontWeight: '600', fontSize: 13 }}>
                None
              </Text>
            </TouchableOpacity>
            {vault.folders.map(f => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFolderId(f.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  borderWidth: 1,
                  borderColor: folderId === f.id ? f.color : theme.border,
                  backgroundColor: folderId === f.id ? f.color + '20' : theme.bg3,
                }}
              >
                <Text style={{ color: folderId === f.id ? f.color : theme.text2, fontWeight: '600', fontSize: 13 }}>
                  {f.icon} {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* ── Tags ── */}
        <Field
          label="Tags (comma separated)"
          value={tags}
          onChangeText={setTags}
          placeholder="work, important, email"
        />

        {/* ── Expiry ── */}
        <Field
          label="Password Expiry Date (optional)"
          value={expiresAt}
          onChangeText={setExpiresAt}
          placeholder="YYYY-MM-DD"
        />

        {/* ── Custom Fields ── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: theme.text3, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Custom Fields
          </Text>
          {customFields.map((cf, i) => (
            <View key={i} style={{
              backgroundColor: theme.bg3, borderRadius: 10,
              borderWidth: 1, borderColor: theme.border,
              padding: 12, marginBottom: 10,
            }}>
              <TextInput
                value={cf.label}
                onChangeText={v => updateCustomField(i, { label: v })}
                placeholder="Field name"
                placeholderTextColor={theme.text3}
                style={{ color: theme.text, fontSize: 13, fontWeight: '600', marginBottom: 6 }}
              />
              <TextInput
                value={cf.value}
                onChangeText={v => updateCustomField(i, { value: v })}
                placeholder="Value"
                placeholderTextColor={theme.text3}
                secureTextEntry={cf.hidden}
                style={{ color: theme.text, fontSize: 14 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                <Text style={{ color: theme.text2, fontSize: 12 }}>Hidden</Text>
                <Switch
                  value={cf.hidden}
                  onValueChange={v => updateCustomField(i, { hidden: v })}
                  trackColor={{ false: theme.bg4, true: theme.accent }}
                  thumbColor={cf.hidden ? '#fff' : theme.text3}
                />
                <TouchableOpacity
                  onPress={() => setCustomFields(customFields.filter((_, j) => j !== i))}
                  style={{ marginLeft: 'auto' }}
                >
                  <Text style={{ color: theme.red, fontSize: 13 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity
            onPress={addCustomField}
            style={{
              borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
              borderRadius: 10, padding: 12, alignItems: 'center',
            }}
          >
            <Text style={{ color: theme.text2, fontSize: 14 }}>+ Add Custom Field</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      <Toast />
    </KeyboardAvoidingView>
  );
}
