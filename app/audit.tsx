// app/audit.tsx
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/context';
import { measureStrength } from '../src/crypto';
import { VaultEntry } from '../src/types';

interface Issue {
  type: 'weak' | 'reused' | 'old' | 'breached' | 'noPassword' | 'expiring';
  entry: VaultEntry;
  detail: string;
}

export default function AuditScreen() {
  const { theme, vault } = useApp();
  const router = useRouter();

  const { score, issues, stats } = useMemo(() => {
    const entries = vault.entries.filter(e => !e.archived && e.type === 'Login');
    const allIssues: Issue[] = [];

    // Password frequency map for duplicate detection
    const pwMap = new Map<string, VaultEntry[]>();
    entries.forEach(e => {
      if (!e.password) return;
      const list = pwMap.get(e.password) ?? [];
      list.push(e);
      pwMap.set(e.password, list);
    });

    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    entries.forEach(e => {
      // No password
      if (!e.password) {
        allIssues.push({ type: 'noPassword', entry: e, detail: 'No password stored' });
        return;
      }
      // Weak
      const str = measureStrength(e.password);
      if (str.score <= 1) {
        allIssues.push({ type: 'weak', entry: e, detail: `${str.label} · ${str.entropy} bits entropy` });
      }
      // Reused
      const dupes = pwMap.get(e.password) ?? [];
      if (dupes.length > 1) {
        const others = dupes.filter(d => d.id !== e.id).map(d => d.title).join(', ');
        allIssues.push({ type: 'reused', entry: e, detail: `Also used in: ${others}` });
      }
      // Old password (> 90 days)
      const age = now - (e.updatedAt ?? e.createdAt);
      if (age > ninetyDays) {
        const days = Math.floor(age / (24 * 60 * 60 * 1000));
        allIssues.push({ type: 'old', entry: e, detail: `Not changed in ${days} days` });
      }
      // Expiring soon (within 30 days)
      if (e.expiresAt && e.expiresAt > now && e.expiresAt < now + thirtyDays) {
        const days = Math.ceil((e.expiresAt - now) / (24 * 60 * 60 * 1000));
        allIssues.push({ type: 'expiring', entry: e, detail: `Expires in ${days} days` });
      }
      // Expired
      if (e.expiresAt && e.expiresAt < now) {
        allIssues.push({ type: 'expiring', entry: e, detail: '⚠️ Expired!' });
      }
    });

    const totalEntries = entries.filter(e => e.password).length;
    const issueCount = allIssues.length;
    const rawScore = totalEntries === 0
      ? 100
      : Math.max(0, Math.round(100 - (issueCount / Math.max(totalEntries, 1)) * 80));

    const stats = {
      total: entries.length,
      withPassword: totalEntries,
      weak: allIssues.filter(i => i.type === 'weak').length,
      reused: allIssues.filter(i => i.type === 'reused').length,
      old: allIssues.filter(i => i.type === 'old').length,
    };

    return { score: rawScore, issues: allIssues, stats };
  }, [vault]);

  const scoreColor = score >= 80 ? '#22c55e'
    : score >= 60 ? '#eab308'
    : score >= 40 ? '#f97316'
    : '#ef4444';

  const scoreLabel = score >= 80 ? 'Great 🛡'
    : score >= 60 ? 'Good 👍'
    : score >= 40 ? 'Fair ⚠️'
    : 'Needs Work 🚨';

  const ISSUE_META = {
    weak:       { icon: '🔓', label: 'Weak Password',     color: '#ef4444' },
    reused:     { icon: '🔁', label: 'Reused Password',   color: '#f97316' },
    old:        { icon: '📅', label: 'Old Password',      color: '#eab308' },
    breached:   { icon: '💀', label: 'Found in Breach',   color: '#dc2626' },
    noPassword: { icon: '❓', label: 'No Password Stored',color: '#8b5cf6' },
    expiring:   { icon: '⏰', label: 'Expiring Soon',     color: '#f97316' },
  };

  // Group issues by type
  const grouped = Object.entries(ISSUE_META).map(([type, meta]) => ({
    type,
    meta,
    items: issues.filter(i => i.type === type),
  })).filter(g => g.items.length > 0);

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
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Security Audit</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* ── Score Card ── */}
        <View style={{
          backgroundColor: theme.card,
          borderRadius: 20, padding: 24,
          borderWidth: 1, borderColor: theme.cardBorder,
          flexDirection: 'row', alignItems: 'center',
          marginBottom: 20,
        }}>
          {/* Score circle */}
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            borderWidth: 5, borderColor: scoreColor,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 20,
          }}>
            <Text style={{ color: scoreColor, fontSize: 24, fontWeight: '900' }}>{score}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>{scoreLabel}</Text>
            <Text style={{ color: theme.text2, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              {stats.total} login entries · {issues.length} issue{issues.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total', value: stats.total, color: theme.accent },
            { label: 'Weak', value: stats.weak, color: '#ef4444' },
            { label: 'Reused', value: stats.reused, color: '#f97316' },
            { label: 'Old', value: stats.old, color: '#eab308' },
          ].map(s => (
            <View key={s.label} style={{
              flex: 1, backgroundColor: theme.card,
              borderRadius: 12, padding: 12, alignItems: 'center',
              borderWidth: 1, borderColor: theme.cardBorder,
            }}>
              <Text style={{ color: s.color, fontSize: 22, fontWeight: '900' }}>{s.value}</Text>
              <Text style={{ color: theme.text2, fontSize: 11, marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Issues ── */}
        {issues.length === 0 ? (
          <View style={{
            backgroundColor: '#22c55e20', borderRadius: 16,
            padding: 24, alignItems: 'center',
            borderWidth: 1, borderColor: '#22c55e40',
          }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
            <Text style={{ color: '#22c55e', fontSize: 18, fontWeight: '800' }}>All Clear!</Text>
            <Text style={{ color: theme.text2, fontSize: 14, marginTop: 6, textAlign: 'center' }}>
              No security issues detected. Keep it up!
            </Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.type} style={{
              backgroundColor: theme.card,
              borderRadius: 16, marginBottom: 14,
              borderWidth: 1, borderColor: theme.cardBorder,
              overflow: 'hidden',
            }}>
              {/* Group header */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                padding: 14, backgroundColor: group.meta.color + '12',
                borderBottomWidth: 1, borderBottomColor: theme.border,
              }}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>{group.meta.icon}</Text>
                <Text style={{ color: group.meta.color, fontWeight: '800', fontSize: 15, flex: 1 }}>
                  {group.meta.label}
                </Text>
                <View style={{
                  backgroundColor: group.meta.color + '20',
                  borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
                }}>
                  <Text style={{ color: group.meta.color, fontWeight: '700', fontSize: 13 }}>
                    {group.items.length}
                  </Text>
                </View>
              </View>
              {/* Items */}
              {group.items.map((issue, i) => (
                <TouchableOpacity
                  key={issue.entry.id + i}
                  onPress={() => router.push({ pathname: '/entry/[id]', params: { id: issue.entry.id } })}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: i < group.items.length - 1 ? 1 : 0,
                    borderBottomColor: theme.border,
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                      {issue.entry.title}
                    </Text>
                    <Text style={{ color: theme.text2, fontSize: 12, marginTop: 2 }}>
                      {issue.detail}
                    </Text>
                  </View>
                  <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '600' }}>Fix →</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}

        {/* Tips */}
        <View style={{
          backgroundColor: theme.accentSoft,
          borderRadius: 14, padding: 16, marginTop: 8,
          borderWidth: 1, borderColor: theme.accent + '30',
        }}>
          <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
            💡 Security Tips
          </Text>
          {[
            'Use a unique password for every account',
            'Enable 2FA on all important accounts',
            'Use 16+ character passwords with mixed types',
            'Change passwords every 90 days for critical accounts',
            'Check for breaches on the entry detail screen',
          ].map((tip, i) => (
            <Text key={i} style={{ color: theme.text2, fontSize: 13, lineHeight: 20 }}>
              • {tip}
            </Text>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}
