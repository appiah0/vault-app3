// app/entry/[id].tsx — View entry details
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/context';
import { VaultEntry } from '../../src/types';
import { ENTRY_TYPE_META } from '../../src/theme';
import { getVault, saveVault } from '../../src/storage';
import { checkBreach, measureStrength } from '../../src/crypto';
import { TotpWidget, ConfirmDialog, Toast, LoadingOverlay } from '../../src/components/UI';

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, vault, showToast, copyToClipboard, saveAndRefresh, setLoading } = useApp();
  const router = useRouter();
  const [entry, setEntry] = useState<VaultEntry | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showCardPin, setShowCardPin] = useState(false);
  const [showWifiPw, setShowWifiPw] = useState(false);
  const [breachCount, setBreachCount] = useState<number | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const e = vault.entries.find(x => x.id === id);
    setEntry(e ?? null);
  }, [id, vault]);

  if (!entry) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.text2 }}>Entry not found</Text>
      </View>
    );
  }

  const meta = ENTRY_TYPE_META[entry.type];
  const folder = vault.folders.find(f => f.id === entry.folderId);
  const str = entry.password ? measureStrength(entry.password) : null;

  async function handleDelete() {
    const v = getVault();
    v.entries = v.entries.filter(e => e.id !== id);
    await saveAndRefresh();
    showToast('🗑 Entry deleted', 'error');
    router.back();
  }

  async function handleBreachCheck() {
    if (!entry.password) return;
    setCheckingBreach(true);
    const count = await checkBreach(entry.password);
    setCheckingBreach(false);
    setBreachCount(count);
    if (count === 0) showToast('✅ Password not found in breaches', 'success');
    else if (count > 0) showToast(`⚠️ Found in ${count.toLocaleString()} breaches!`, 'error');
    else showToast('Network error — check connection', 'error');
  }

  async function toggleFav() {
    const v = getVault();
    const idx = v.entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    v.entries[idx].favourite = !v.entries[idx].favourite;
    await saveAndRefresh();
    setEntry({ ...v.entries[idx] });
    showToast(v.entries[idx].favourite ? '⭐ Added to favourites' : 'Removed from favourites');
  }

  function FieldRow({
    label, value, secret = false, visible, onToggleVis, canCopy = true
  }: {
    label: string; value: string;
    secret?: boolean; visible?: boolean;
    onToggleVis?: () => void; canCopy?: boolean;
  }) {
    const display = secret && !visible
      ? '••••••••••••'
      : value;
    return (
      <View style={{
        backgroundColor: theme.bg3, borderRadius: 10,
        borderWidth: 1, borderColor: theme.border,
        marginBottom: 10,
      }}>
        <Text style={{
          color: theme.text3, fontSize: 10, fontWeight: '700',
          letterSpacing: 1, textTransform: 'uppercase',
          paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2,
        }}>
          {label}
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingBottom: 10,
        }}>
          <Text style={{
            flex: 1, color: theme.text, fontSize: 15,
            fontFamily: secret ? 'monospace' : undefined,
            letterSpacing: secret && !visible ? 2 : 0,
          }} selectable={!secret || visible}>
            {display}
          </Text>
          {secret && (
            <TouchableOpacity onPress={onToggleVis} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18 }}>{visible ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          )}
          {canCopy && (
            <TouchableOpacity
              onPress={() => copyToClipboard(value, `${label} copied`)}
              style={{ padding: 6 }}
            >
              <Text style={{ fontSize: 18 }}>📋</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{
        paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16,
        backgroundColor: theme.bg,
        borderBottomWidth: 1, borderBottomColor: theme.border,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: theme.accent, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <View style={{
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: meta.color + '20',
          alignItems: 'center', justifyContent: 'center', marginRight: 12,
        }}>
          <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
            {entry.title}
          </Text>
          <Text style={{ color: theme.text2, fontSize: 12 }}>{meta.label}</Text>
        </View>
        <TouchableOpacity onPress={toggleFav} style={{ marginRight: 8 }}>
          <Text style={{ fontSize: 22 }}>{entry.favourite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/entry/[id]/edit', params: { id: entry.id } })}
        >
          <Text style={{ fontSize: 22 }}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>

        {/* ── LOGIN fields ── */}
        {entry.type === 'Login' && (
          <>
            {entry.username && (
              <FieldRow label="Username / Email" value={entry.username} />
            )}
            {entry.password && (
              <>
                <FieldRow
                  label="Password"
                  value={entry.password}
                  secret visible={showPassword}
                  onToggleVis={() => setShowPassword(v => !v)}
                />
                {/* Strength */}
                {str && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    marginBottom: 10, gap: 8,
                  }}>
                    <View style={{
                      flex: 1, height: 4, backgroundColor: theme.bg4,
                      borderRadius: 2, overflow: 'hidden',
                    }}>
                      <View style={{
                        width: `${Math.min(100, str.entropy)}%`,
                        height: 4, backgroundColor: str.color, borderRadius: 2,
                      }} />
                    </View>
                    <Text style={{ color: str.color, fontSize: 12, fontWeight: '700' }}>
                      {str.label}
                    </Text>
                  </View>
                )}
                {/* Breach check */}
                <TouchableOpacity
                  onPress={handleBreachCheck}
                  disabled={checkingBreach}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: breachCount === null ? theme.bg3
                      : breachCount === 0 ? '#16a34a20' : '#dc262620',
                    borderRadius: 10, padding: 12, marginBottom: 12,
                    borderWidth: 1,
                    borderColor: breachCount === null ? theme.border
                      : breachCount === 0 ? '#16a34a' : '#dc2626',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>
                    {checkingBreach ? '⏳' : breachCount === null ? '🛡' : breachCount === 0 ? '✅' : '⚠️'}
                  </Text>
                  <Text style={{
                    flex: 1, fontSize: 13, fontWeight: '600',
                    color: breachCount === null ? theme.text2
                      : breachCount === 0 ? '#16a34a' : '#dc2626',
                  }}>
                    {checkingBreach ? 'Checking breaches…'
                      : breachCount === null ? 'Check for data breaches (HIBP)'
                      : breachCount === 0 ? 'Not found in any known breaches'
                      : `Found in ${breachCount.toLocaleString()} breaches!`}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {entry.url && (
              <FieldRow label="Website URL" value={entry.url} canCopy />
            )}
            {entry.totp && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{
                  color: theme.text3, fontSize: 10, fontWeight: '700',
                  letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
                }}>
                  2FA / TOTP
                </Text>
                <TotpWidget secret={entry.totp} />
              </View>
            )}
          </>
        )}

        {/* ── CARD fields ── */}
        {entry.type === 'Card' && (
          <>
            {entry.cardholderName && <FieldRow label="Cardholder Name" value={entry.cardholderName} />}
            {entry.cardNumber && (
              <FieldRow label="Card Number" value={entry.cardNumber} secret visible={showPassword} onToggleVis={() => setShowPassword(v=>!v)} />
            )}
            {entry.expiry && <FieldRow label="Expiry" value={entry.expiry} />}
            {entry.cvv && (
              <FieldRow label="CVV" value={entry.cvv} secret visible={showCvv} onToggleVis={() => setShowCvv(v=>!v)} />
            )}
            {entry.pin && (
              <FieldRow label="PIN" value={entry.pin} secret visible={showCardPin} onToggleVis={() => setShowCardPin(v=>!v)} />
            )}
          </>
        )}

        {/* ── WIFI fields ── */}
        {entry.type === 'WiFi' && (
          <>
            {entry.ssid && <FieldRow label="Network Name (SSID)" value={entry.ssid} />}
            {entry.security && <FieldRow label="Security Type" value={entry.security} canCopy={false} />}
            {entry.wifiPassword && (
              <FieldRow label="Wi-Fi Password" value={entry.wifiPassword} secret visible={showWifiPw} onToggleVis={() => setShowWifiPw(v=>!v)} />
            )}
          </>
        )}

        {/* ── NOTE ── */}
        {entry.type === 'Note' && entry.note && (
          <View style={{
            backgroundColor: theme.bg3, borderRadius: 10,
            borderWidth: 1, borderColor: theme.border,
            padding: 14, marginBottom: 12,
          }}>
            <Text style={{
              color: theme.text3, fontSize: 10, fontWeight: '700',
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
            }}>
              Secure Note
            </Text>
            <Text style={{ color: theme.text, fontSize: 14, lineHeight: 22 }} selectable>
              {entry.note}
            </Text>
          </View>
        )}

        {/* ── Custom fields ── */}
        {entry.customFields?.map((cf, i) => (
          <FieldRow
            key={i}
            label={cf.label}
            value={cf.value}
            secret={cf.hidden}
            visible={!cf.hidden}
            canCopy
          />
        ))}

        {/* ── Note (on non-Note entries) ── */}
        {entry.type !== 'Note' && entry.note && (
          <View style={{
            backgroundColor: theme.bg3, borderRadius: 10,
            borderWidth: 1, borderColor: theme.border,
            padding: 14, marginBottom: 12,
          }}>
            <Text style={{ color: theme.text3, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Notes
            </Text>
            <Text style={{ color: theme.text2, fontSize: 14, lineHeight: 20 }}>{entry.note}</Text>
          </View>
        )}

        {/* ── Tags ── */}
        {entry.tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {entry.tags.map(tag => (
              <View key={tag} style={{
                backgroundColor: theme.accentSoft, borderRadius: 6,
                paddingHorizontal: 10, paddingVertical: 4,
                borderWidth: 1, borderColor: theme.accent + '30',
              }}>
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Password history ── */}
        {(entry.passwordHistory?.length ?? 0) > 0 && (
          <TouchableOpacity
            onPress={() => setShowHistory(v => !v)}
            style={{
              backgroundColor: theme.bg3, borderRadius: 10,
              borderWidth: 1, borderColor: theme.border,
              padding: 14, marginBottom: 12,
            }}
          >
            <Text style={{ color: theme.text2, fontSize: 14, fontWeight: '600' }}>
              🕐 Password History ({entry.passwordHistory!.length}) {showHistory ? '▲' : '▼'}
            </Text>
            {showHistory && entry.passwordHistory!.map((h, i) => (
              <View key={i} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Text style={{ color: theme.text3, fontSize: 11, marginBottom: 4 }}>
                  {new Date(h.changedAt).toLocaleDateString()}
                </Text>
                <Text style={{ color: theme.text, fontFamily: 'monospace', fontSize: 13 }}>
                  {'•'.repeat(Math.min(h.password.length, 16))}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        )}

        {/* ── Metadata ── */}
        <View style={{
          backgroundColor: theme.bg3, borderRadius: 10,
          borderWidth: 1, borderColor: theme.border,
          padding: 14, marginBottom: 20,
        }}>
          <Text style={{ color: theme.text3, fontSize: 12, marginBottom: 4 }}>
            Created: {new Date(entry.createdAt).toLocaleString()}
          </Text>
          <Text style={{ color: theme.text3, fontSize: 12, marginBottom: entry.lastUsedAt ? 4 : 0 }}>
            Modified: {new Date(entry.updatedAt).toLocaleString()}
          </Text>
          {entry.lastUsedAt && (
            <Text style={{ color: theme.text3, fontSize: 12 }}>
              Last used: {new Date(entry.lastUsedAt).toLocaleString()}
            </Text>
          )}
          {entry.expiresAt && (
            <Text style={{
              fontSize: 12, marginTop: 4,
              color: entry.expiresAt < Date.now() ? theme.red : theme.yellow,
            }}>
              {entry.expiresAt < Date.now() ? '⚠️ Expired: ' : '📅 Expires: '}
              {new Date(entry.expiresAt).toLocaleDateString()}
            </Text>
          )}
          {folder && (
            <Text style={{ color: theme.text3, fontSize: 12, marginTop: 4 }}>
              📁 {folder.icon} {folder.name}
            </Text>
          )}
        </View>

        {/* ── Delete ── */}
        <TouchableOpacity
          onPress={() => setDeleteConfirm(true)}
          style={{
            backgroundColor: theme.red + '15',
            borderRadius: 10, padding: 14, alignItems: 'center',
            borderWidth: 1, borderColor: theme.red + '30',
          }}
        >
          <Text style={{ color: theme.red, fontWeight: '700', fontSize: 15 }}>
            🗑 Delete Entry
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete Entry?"
        body={`"${entry.title}" will be permanently deleted and cannot be recovered.`}
        onConfirm={() => { setDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setDeleteConfirm(false)}
      />

      <Toast />
      <LoadingOverlay />
    </View>
  );
}
