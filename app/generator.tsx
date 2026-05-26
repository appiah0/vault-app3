// app/generator.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/context';
import { generatePassword, GenOptions, DEFAULT_GEN_OPTIONS } from '../src/generator';
import { measureStrength } from '../src/crypto';
import { ToggleRow } from '../src/components/UI';

export default function GeneratorScreen() {
  const { theme, copyToClipboard } = useApp();
  const router = useRouter();
  const [opts, setOpts] = useState<GenOptions>({ ...DEFAULT_GEN_OPTIONS });
  const [pw, setPw] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => { regen(); }, [opts]);

  function regen() {
    const p = generatePassword(opts);
    setPw(p);
    setHistory(h => [p, ...h].slice(0, 10));
  }

  function toggle(key: keyof GenOptions) {
    setOpts(o => ({ ...o, [key]: !o[key] }));
  }

  const str = measureStrength(pw);
  const LENGTH_PRESETS = [8, 12, 16, 20, 24, 32, 48, 64];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{
        paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: theme.border,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: theme.accent, fontSize: 24 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
          Password Generator
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* Output card */}
        <View style={{
          backgroundColor: theme.card, borderRadius: 20,
          borderWidth: 1, borderColor: theme.cardBorder,
          padding: 20, marginBottom: 16,
        }}>
          <Text
            style={{
              color: theme.accent,
              fontSize: opts.passphrase ? 17 : 19,
              fontFamily: 'monospace',
              letterSpacing: opts.passphrase ? 1 : 2,
              lineHeight: 28, marginBottom: 16, minHeight: 56,
            }}
            selectable
          >
            {pw || '—'}
          </Text>

          {/* Strength */}
          <View style={{
            height: 5, backgroundColor: theme.bg4,
            borderRadius: 3, overflow: 'hidden', marginBottom: 6,
          }}>
            <View style={{
              height: 5, borderRadius: 3,
              width: `${Math.min(100, str.entropy)}%`,
              backgroundColor: str.color,
            }} />
          </View>
          <Text style={{ color: str.color, fontSize: 12, fontWeight: '700', marginBottom: 16 }}>
            {str.label} · {str.entropy} bits entropy
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={regen}
              style={{
                flex: 1, backgroundColor: theme.bg3,
                borderRadius: 12, padding: 14, alignItems: 'center',
                borderWidth: 1, borderColor: theme.border,
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>↻ New</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => copyToClipboard(pw, 'Password copied')}
              style={{
                flex: 2, backgroundColor: theme.accent,
                borderRadius: 12, padding: 14, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>📋 Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Options */}
        <View style={{
          backgroundColor: theme.card, borderRadius: 16,
          borderWidth: 1, borderColor: theme.cardBorder,
          marginBottom: 16, overflow: 'hidden',
        }}>
          {/* Length */}
          <View style={{
            padding: 16,
            borderBottomWidth: 1, borderBottomColor: theme.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>Length</Text>
              <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '800', fontFamily: 'monospace' }}>
                {opts.length}
              </Text>
            </View>
            {/* Preset buttons */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LENGTH_PRESETS.map(n => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setOpts(o => ({ ...o, length: n }))}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 12,
                    borderRadius: 8, borderWidth: 1,
                    borderColor: opts.length === n ? theme.accent : theme.border,
                    backgroundColor: opts.length === n ? theme.accentSoft : theme.bg3,
                  }}
                >
                  <Text style={{
                    color: opts.length === n ? theme.accent : theme.text2,
                    fontSize: 13, fontWeight: '700',
                  }}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ToggleRow label="Uppercase (A–Z)"      value={opts.upper}       onToggle={() => toggle('upper')} />
          <ToggleRow label="Lowercase (a–z)"      value={opts.lower}       onToggle={() => toggle('lower')} />
          <ToggleRow label="Numbers (0–9)"        value={opts.numbers}     onToggle={() => toggle('numbers')} />
          <ToggleRow label="Symbols (!@#…)"       value={opts.symbols}     onToggle={() => toggle('symbols')} />
          <ToggleRow
            label="Exclude Ambiguous"
            sub="Removes 0, O, 1, l, I"
            value={opts.noAmbiguous}
            onToggle={() => toggle('noAmbiguous')}
          />
          <ToggleRow
            label="Passphrase Mode"
            sub="word-word-word-42"
            value={opts.passphrase}
            onToggle={() => toggle('passphrase')}
          />
        </View>

        {/* History */}
        {history.length > 1 && (
          <View>
            <Text style={{
              color: theme.text3, fontSize: 11, fontWeight: '700',
              letterSpacing: 1, textTransform: 'uppercase',
              marginBottom: 10, marginTop: 4,
            }}>
              Recent Generated
            </Text>
            <View style={{
              backgroundColor: theme.card, borderRadius: 16,
              borderWidth: 1, borderColor: theme.cardBorder, overflow: 'hidden',
            }}>
              {history.slice(1).map((p, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => copyToClipboard(p, 'Password copied')}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: i < history.slice(1).length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                  }}
                >
                  <Text
                    style={{ flex: 1, color: theme.text2, fontFamily: 'monospace', fontSize: 13 }}
                    numberOfLines={1}
                  >
                    {p}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: 16, marginLeft: 8 }}>📋</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
