// app/setup.tsx
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/context';
import { Field, StrengthBar, Btn, PinPad } from '../src/components/UI';
import { setupVault } from '../src/storage';
import { measureStrength } from '../src/crypto';

type Step = 'welcome' | 'master' | 'pin' | 'pin_confirm';

export default function SetupScreen() {
  const { theme, setLoading, showToast, checkSetup, setUnlocked } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [masterPw, setMasterPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [masterErr, setMasterErr] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [pinErr, setPinErr] = useState('');

  const str = measureStrength(masterPw);

  async function validateMaster() {
    setMasterErr('');
    if (masterPw.length < 10) { setMasterErr('At least 10 characters required.'); return; }
    if (masterPw !== confirmPw) { setMasterErr('Passwords do not match.'); return; }
    if (str.score < 2) { setMasterErr('Password too weak — add numbers or symbols.'); return; }
    setStep('pin');
  }

  async function handlePinEntry(p: string) {
    setPin(p);
    if (p.length === 6) {
      setTimeout(() => setStep('pin_confirm'), 150);
    }
  }

  async function handlePin2Entry(p: string) {
    setPin2(p);
    setPinErr('');
    if (p.length === 6) {
      if (p !== pin) {
        setPinErr('PINs do not match. Try again.');
        setPin2('');
        setTimeout(() => setStep('pin'), 500);
        return;
      }
      // All good — create vault
      setLoading(true, 'Creating your vault…');
      try {
        await setupVault(masterPw, pin);
        await checkSetup();
        setUnlocked(true);
        showToast('✅ Vault created!', 'success');
        router.replace('/');
      } catch (e) {
        showToast('Setup failed. Try again.', 'error');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text style={{ fontSize: 56 }}>🔐</Text>
          <Text style={{ color: theme.text, fontSize: 32, fontWeight: '900', marginTop: 8 }}>Vault</Text>
          <Text style={{ color: theme.text2, fontSize: 14, marginTop: 4 }}>Zero-knowledge password manager</Text>
        </View>

        {/* ── Welcome ── */}
        {step === 'welcome' && (
          <View>
            <Text style={[st.h2, { color: theme.text }]}>Welcome to Vault</Text>
            <Text style={[st.sub, { color: theme.text2 }]}>
              Your passwords are encrypted on your device only. Nobody — not even us — can access them.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28, marginTop: 16 }}>
              {['AES-256-GCM', 'PBKDF2 · 200k', 'Zero-knowledge', 'Offline-first'].map(p => (
                <View key={p} style={{
                  backgroundColor: theme.accentSoft, borderRadius: 20,
                  paddingHorizontal: 12, paddingVertical: 6,
                  borderWidth: 1, borderColor: theme.accent + '40',
                }}>
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>{p}</Text>
                </View>
              ))}
            </View>
            <Btn label="Get Started →" onPress={() => setStep('master')} />
          </View>
        )}

        {/* ── Master Password ── */}
        {step === 'master' && (
          <View>
            <Text style={[st.h2, { color: theme.text }]}>Create Master Password</Text>
            <Text style={[st.sub, { color: theme.text2 }]}>
              This is the ONLY password you'll need to remember. It encrypts your entire vault.
            </Text>
            <View style={{ marginTop: 16 }}>
              <Field
                label="Master Password"
                value={masterPw}
                onChangeText={setMasterPw}
                secret
                placeholder="Min 10 characters"
                autoFocus
              />
              <StrengthBar password={masterPw} />
              <View style={{ height: 12 }} />
              <Field
                label="Confirm Password"
                value={confirmPw}
                onChangeText={setConfirmPw}
                secret
                placeholder="Repeat your password"
              />
              {masterErr ? (
                <Text style={{ color: theme.red, fontSize: 13, marginBottom: 12 }}>{masterErr}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Btn label="← Back" onPress={() => setStep('welcome')} variant="ghost" style={{ flex: 1 }} />
              <Btn label="Continue →" onPress={validateMaster} style={{ flex: 2 }} />
            </View>
          </View>
        )}

        {/* ── PIN ── */}
        {step === 'pin' && (
          <View style={{ alignItems: 'center' }}>
            <Text style={[st.h2, { color: theme.text, textAlign: 'center' }]}>Set a 6-Digit PIN</Text>
            <Text style={[st.sub, { color: theme.text2, textAlign: 'center', marginBottom: 32 }]}>
              Used for quick daily unlocking. Master password is the fallback.
            </Text>
            <PinPad pin={pin} onPinChange={handlePinEntry} />
            {pinErr ? <Text style={{ color: theme.red, marginTop: 12 }}>{pinErr}</Text> : null}
            <TouchableOpacity onPress={() => { setStep('master'); setPin(''); }}>
              <Text style={{ color: theme.text2, marginTop: 20 }}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PIN Confirm ── */}
        {step === 'pin_confirm' && (
          <View style={{ alignItems: 'center' }}>
            <Text style={[st.h2, { color: theme.text, textAlign: 'center' }]}>Confirm PIN</Text>
            <Text style={[st.sub, { color: theme.text2, textAlign: 'center', marginBottom: 32 }]}>
              Enter your PIN one more time.
            </Text>
            <PinPad pin={pin2} onPinChange={handlePin2Entry} />
            {pinErr ? <Text style={{ color: theme.red, marginTop: 12 }}>{pinErr}</Text> : null}
            <TouchableOpacity onPress={() => { setStep('pin'); setPin(''); setPin2(''); }}>
              <Text style={{ color: theme.text2, marginTop: 20 }}>← Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  h2: { fontSize: 26, fontWeight: '800', marginBottom: 10 },
  sub: { fontSize: 14, lineHeight: 22 },
});
