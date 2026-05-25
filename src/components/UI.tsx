// src/components/UI.tsx
// Shared UI primitives used across all screens

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Modal, ScrollView,
  Switch, Platform, Pressable, TextInputProps
} from 'react-native';
import { useApp } from '../context';
import { Theme } from '../theme';
import { measureStrength } from '../crypto';

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  children, style, onPress, onLongPress
}: {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { theme } = useApp();
  const s = styles(theme);
  const Wrapper = (onPress || onLongPress) ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[s.card, style]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {children}
    </Wrapper>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

interface FieldProps extends TextInputProps {
  label?: string;
  secret?: boolean;
  rightIcon?: React.ReactNode;
  onRightIcon?: () => void;
  error?: string;
}

export function Field({
  label, secret = false, rightIcon, onRightIcon, error, style, ...props
}: FieldProps) {
  const { theme } = useApp();
  const [visible, setVisible] = useState(!secret);
  const s = styles(theme);

  return (
    <View style={[s.fieldWrap, style as object]}>
      {label && <Text style={s.fieldLabel}>{label}</Text>}
      <View style={s.fieldRow}>
        <TextInput
          {...props}
          secureTextEntry={!visible}
          style={[s.fieldInput, error ? { borderColor: theme.red } : {}]}
          placeholderTextColor={theme.text3}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secret && (
          <TouchableOpacity
            style={s.fieldEye}
            onPress={() => setVisible(v => !v)}
          >
            <Text style={s.fieldEyeText}>{visible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
        {rightIcon && (
          <TouchableOpacity style={s.fieldEye} onPress={onRightIcon}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={[s.errText]}>{error}</Text> : null}
    </View>
  );
}

// ─── StrengthBar ─────────────────────────────────────────────────────────────

export function StrengthBar({ password }: { password: string }) {
  const { theme } = useApp();
  const s = measureStrength(password);
  const width = password ? `${Math.min(100, (s.entropy / 100) * 100)}%` : '0%';

  return (
    <View style={{ marginTop: 6 }}>
      <View style={{
        height: 4, backgroundColor: theme.bg4,
        borderRadius: 2, overflow: 'hidden'
      }}>
        <View style={{
          height: 4, width, backgroundColor: s.color,
          borderRadius: 2
        }} />
      </View>
      {password ? (
        <Text style={{ fontSize: 11, color: s.color, marginTop: 4, fontFamily: 'DMmono' }}>
          {s.label} · {s.entropy} bits entropy
        </Text>
      ) : null}
    </View>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

export function Btn({
  label, onPress, variant = 'primary', style, disabled, icon
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  style?: object;
  disabled?: boolean;
  icon?: string;
}) {
  const { theme } = useApp();
  const bgMap = {
    primary: theme.accent,
    secondary: theme.bg3,
    danger: theme.red,
    ghost: 'transparent',
  };
  const colorMap = {
    primary: '#fff',
    secondary: theme.text,
    danger: '#fff',
    ghost: theme.text2,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[{
        backgroundColor: bgMap[variant],
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        borderWidth: variant === 'ghost' ? 1 : 0,
        borderColor: theme.border,
      }, style as object]}
    >
      {icon && <Text style={{ fontSize: 16 }}>{icon}</Text>}
      <Text style={{
        color: colorMap[variant],
        fontWeight: '700',
        fontSize: 15,
      }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Toggle Row ──────────────────────────────────────────────────────────────

export function ToggleRow({
  label, sub, value, onToggle
}: {
  label: string; sub?: string; value: boolean; onToggle: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: theme.border,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {sub && <Text style={{ color: theme.text2, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.bg4, true: theme.accent }}
        thumbColor={value ? '#fff' : theme.text3}
      />
    </View>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

export function SectionHeader({ title }: { title: string }) {
  const { theme } = useApp();
  return (
    <Text style={{
      color: theme.text3, fontSize: 11, fontWeight: '700',
      letterSpacing: 1, textTransform: 'uppercase',
      paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
    }}>
      {title}
    </Text>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function Toast() {
  const { toast, theme } = useApp();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      Animated.spring(anim, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [toast]);

  if (!toast) return null;

  const bgColor = toast.type === 'error' ? '#ef4444'
    : toast.type === 'success' ? '#22c55e'
    : theme.bg3;

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 100, alignSelf: 'center',
      backgroundColor: bgColor,
      paddingHorizontal: 20, paddingVertical: 12,
      borderRadius: 30, zIndex: 9999,
      transform: [{ scale: anim }],
      shadowColor: '#000', shadowOpacity: 0.3,
      shadowRadius: 8, elevation: 10,
      maxWidth: '85%',
    }}>
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
        {toast.msg}
      </Text>
    </Animated.View>
  );
}

// ─── Loading overlay ─────────────────────────────────────────────────────────

export function LoadingOverlay() {
  const { loading, loadingText, theme } = useApp();
  if (!loading) return null;
  return (
    <View style={{
      position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center', justifyContent: 'center', zIndex: 9998,
    }}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={{ color: '#fff', marginTop: 12, fontSize: 14 }}>{loadingText}</Text>
    </View>
  );
}

// ─── PIN Pad ─────────────────────────────────────────────────────────────────

export function PinPad({
  pin, onPinChange
}: {
  pin: string;
  onPinChange: (newPin: string) => void;
}) {
  const { theme } = useApp();
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  function press(k: string) {
    if (k === '⌫') {
      onPinChange(pin.slice(0, -1));
    } else if (k && pin.length < 6) {
      const next = pin + k;
      onPinChange(next);
    }
  }

  return (
    <View>
      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
        {[0,1,2,3,4,5].map(i => (
          <View key={i} style={{
            width: 14, height: 14, borderRadius: 7,
            backgroundColor: i < pin.length ? theme.accent : theme.bg4,
            borderWidth: 2, borderColor: i < pin.length ? theme.accent : theme.border2,
          }} />
        ))}
      </View>
      {/* Keys */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', maxWidth: 280, alignSelf: 'center' }}>
        {keys.map((k, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => press(k)}
            disabled={k === ''}
            activeOpacity={0.7}
            style={{
              width: 80, height: 64, margin: 6,
              backgroundColor: k === '' ? 'transparent' : theme.bg3,
              borderRadius: 14,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: k === '' ? 0 : 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{
              color: k === '⌫' ? theme.text2 : theme.text,
              fontSize: k === '⌫' ? 20 : 24,
              fontWeight: '600',
            }}>
              {k}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Action Sheet ────────────────────────────────────────────────────────────

interface ActionItem {
  label: string;
  icon?: string;
  danger?: boolean;
  onPress: () => void;
}

export function ActionSheet({
  visible, onClose, title, actions
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionItem[];
}) {
  const { theme } = useApp();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View style={{
        backgroundColor: theme.bg2,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: 34, paddingTop: 8,
      }}>
        <View style={{
          width: 40, height: 4, backgroundColor: theme.border2,
          borderRadius: 2, alignSelf: 'center', marginBottom: 16,
        }} />
        {title && (
          <Text style={{
            color: theme.text2, fontSize: 13, fontWeight: '600',
            textAlign: 'center', marginBottom: 8,
          }}>
            {title}
          </Text>
        )}
        {actions.map((a, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => { onClose(); a.onPress(); }}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 16, paddingHorizontal: 20,
              borderTopWidth: i === 0 ? 1 : 0, borderTopColor: theme.border,
              borderBottomWidth: 1, borderBottomColor: theme.border,
            }}
          >
            {a.icon && <Text style={{ fontSize: 20, marginRight: 14 }}>{a.icon}</Text>}
            <Text style={{
              fontSize: 16, fontWeight: '500',
              color: a.danger ? theme.red : theme.text,
            }}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({
  visible, title, body, confirmLabel = 'Delete',
  danger = true, onConfirm, onCancel
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { theme } = useApp();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <View style={{
          backgroundColor: theme.bg2, borderRadius: 20,
          padding: 24, width: '100%', maxWidth: 340,
          borderWidth: 1, borderColor: theme.border,
        }}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>{title}</Text>
          <Text style={{ color: theme.text2, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>{body}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 10,
                backgroundColor: theme.bg3, alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 10,
                backgroundColor: danger ? theme.red : theme.accent,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── TOTP Widget ─────────────────────────────────────────────────────────────

export function TotpWidget({ secret }: { secret: string }) {
  const { theme, copyToClipboard } = useApp();
  const [code, setCode] = useState('------');
  const [secsLeft, setSecsLeft] = useState(30);

  useEffect(() => {
    let running = true;
    async function tick() {
      const { generateTOTP, totpSecondsLeft, formatTotpCode } = await import('../totp');
      while (running) {
        const c = await generateTOTP(secret);
        const s = totpSecondsLeft();
        setCode(formatTotpCode(c));
        setSecsLeft(s);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    tick();
    return () => { running = false; };
  }, [secret]);

  const pct = secsLeft / 30;
  const color = secsLeft <= 5 ? theme.red : secsLeft <= 10 ? theme.yellow : theme.accent;

  return (
    <TouchableOpacity
      onPress={() => copyToClipboard(code.replace(' ', ''), 'TOTP code copied')}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.bg3, borderRadius: 12,
        padding: 16, gap: 16,
        borderWidth: 1, borderColor: theme.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text2, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
          2FA Code
        </Text>
        <Text style={{
          color, fontSize: 28, fontWeight: '800',
          letterSpacing: 6, fontFamily: 'DMmono',
        }}>
          {code}
        </Text>
        <Text style={{ color: theme.text3, fontSize: 12, marginTop: 4 }}>
          Tap to copy · {secsLeft}s remaining
        </Text>
      </View>
      {/* Ring */}
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        borderWidth: 3, borderColor: color,
        alignItems: 'center', justifyContent: 'center',
        opacity: pct,
      }}>
        <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{secsLeft}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles factory ──────────────────────────────────────────────────────────

function styles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      marginHorizontal: 16,
      marginVertical: 6,
    },
    fieldWrap: { marginBottom: 16, paddingHorizontal: 16 },
    fieldLabel: {
      color: theme.text2, fontSize: 12, fontWeight: '700',
      letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase',
    },
    fieldRow: { flexDirection: 'row', alignItems: 'center' },
    fieldInput: {
      flex: 1, backgroundColor: theme.bg3,
      borderWidth: 1, borderColor: theme.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
      color: theme.text, fontSize: 15,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fieldEye: { padding: 10, marginLeft: 4 },
    fieldEyeText: { fontSize: 18 },
    errText: { color: theme.red, fontSize: 12, marginTop: 4 },
  });
}
