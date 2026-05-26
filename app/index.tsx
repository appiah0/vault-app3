// app/index.tsx  — Main vault screen
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, SectionList
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useApp } from '../src/context';
import { VaultEntry } from '../src/types';
import { ENTRY_TYPE_META } from '../src/theme';
import { getVault, saveVault, lockVault } from '../src/storage';
import { ActionSheet, ConfirmDialog, Toast, LoadingOverlay } from '../src/components/UI';

type FilterMode = 'all' | 'fav' | 'recent' | 'archive' | string; // string = folderId

export default function VaultScreen() {
  const { theme, vault, refreshVault, saveAndRefresh, showToast, setLoading } = useApp();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'name' | 'recent' | 'fav'>('recent');
  const [actionEntry, setActionEntry] = useState<VaultEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultEntry | null>(null);

  useFocusEffect(useCallback(() => { refreshVault(); }, []));

  // ── Filtered & sorted entries ──
  const entries = useMemo(() => {
    let list = vault.entries;

    // Active/archive split
    if (filter === 'archive') {
      list = list.filter(e => e.archived);
    } else {
      list = list.filter(e => !e.archived);
      if (filter === 'fav') list = list.filter(e => e.favourite);
      else if (filter === 'recent') {
        list = [...list]
          .filter(e => e.lastUsedAt)
          .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
          .slice(0, 20);
      } else if (filter !== 'all') {
        list = list.filter(e => e.folderId === filter);
      }
    }

    // Type filter
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.username?.toLowerCase().includes(q) ||
        e.url?.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)) ||
        vault.folders.find(f => f.id === e.folderId)?.name.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortMode === 'name') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === 'recent') list = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    else if (sortMode === 'fav') list = [...list].sort((a, b) => (b.favourite ? 1 : 0) - (a.favourite ? 1 : 0));

    return list;
  }, [vault, filter, typeFilter, search, sortMode]);

  // ── Recently used (top 5) ──
  const recentlyUsed = useMemo(() =>
    [...vault.entries]
      .filter(e => e.lastUsedAt && !e.archived)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, 5),
    [vault]
  );

  // ── Actions ──
  async function toggleFav(entry: VaultEntry) {
    const v = getVault();
    const idx = v.entries.findIndex(e => e.id === entry.id);
    if (idx === -1) return;
    v.entries[idx].favourite = !v.entries[idx].favourite;
    await saveAndRefresh();
    showToast(v.entries[idx].favourite ? '⭐ Added to favourites' : 'Removed from favourites');
  }

  async function toggleArchive(entry: VaultEntry) {
    const v = getVault();
    const idx = v.entries.findIndex(e => e.id === entry.id);
    if (idx === -1) return;
    v.entries[idx].archived = !v.entries[idx].archived;
    await saveAndRefresh();
    showToast(v.entries[idx].archived ? '📦 Archived' : '↩ Unarchived');
  }

  async function deleteEntry(entry: VaultEntry) {
    const v = getVault();
    v.entries = v.entries.filter(e => e.id !== entry.id);
    await saveAndRefresh();
    showToast('🗑 Entry deleted', 'error');
  }

  async function openEntry(entry: VaultEntry) {
    // Update last used
    const v = getVault();
    const idx = v.entries.findIndex(e => e.id === entry.id);
    if (idx !== -1) {
      v.entries[idx].lastUsedAt = Date.now();
      await saveVault();
    }
    router.push({ pathname: '/entry/[id]', params: { id: entry.id } });
  }

  // ── Render entry card ──
  function renderEntry({ item }: { item: VaultEntry }) {
    const meta = ENTRY_TYPE_META[item.type];
    const folder = vault.folders.find(f => f.id === item.folderId);

    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: theme.card,
          marginHorizontal: 16, marginVertical: 4,
          borderRadius: 14, padding: 14,
          borderWidth: 1, borderColor: theme.cardBorder,
        }}
        onPress={() => openEntry(item)}
        onLongPress={() => setActionEntry(item)}
        activeOpacity={0.75}
      >
        {/* Icon */}
        <View style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: meta.color + '20',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 14,
        }}>
          <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{
              color: theme.text, fontSize: 15, fontWeight: '700',
              flexShrink: 1,
            }} numberOfLines={1}>
              {item.title}
            </Text>
            {item.favourite && <Text style={{ fontSize: 12 }}>⭐</Text>}
            {item.totp && <Text style={{ fontSize: 12 }}>🔐</Text>}
          </View>
          <Text style={{ color: theme.text2, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {item.username || item.ssid || item.cardholderName || item.type}
          </Text>
          {(item.tags.length > 0 || folder) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {folder && (
                <View style={{
                  backgroundColor: theme.accentSoft, borderRadius: 4,
                  paddingHorizontal: 6, paddingVertical: 2,
                }}>
                  <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>
                    {folder.icon} {folder.name}
                  </Text>
                </View>
              )}
              {item.tags.slice(0, 2).map(tag => (
                <View key={tag} style={{
                  backgroundColor: theme.bg4, borderRadius: 4,
                  paddingHorizontal: 6, paddingVertical: 2,
                }}>
                  <Text style={{ color: theme.text3, fontSize: 10 }}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={{ color: theme.text3, fontSize: 20, marginLeft: 8 }}>›</Text>
      </TouchableOpacity>
    );
  }

  const sortLabels = { name: 'A–Z', recent: 'Recent', fav: 'Favs' };
  const nextSort: Record<string, 'name' | 'recent' | 'fav'> = { name: 'recent', recent: 'fav', fav: 'name' };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>

      {/* ── Header ── */}
      <View style={{
        paddingTop: 56, paddingBottom: 8,
        paddingHorizontal: 16,
        backgroundColor: theme.bg,
        borderBottomWidth: 1, borderBottomColor: theme.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', flex: 1 }}>🔐 Vault</Text>
          <TouchableOpacity
            onPress={() => router.push('/entry/new')}
            style={{
              backgroundColor: theme.accent, width: 36, height: 36,
              borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 22, lineHeight: 26 }}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Text style={{ fontSize: 24 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: theme.bg3, borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 8,
          borderWidth: 1, borderColor: theme.border,
        }}>
          <Text style={{ color: theme.text3, marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search vault…"
            placeholderTextColor={theme.text3}
            style={{ flex: 1, color: theme.text, fontSize: 14 }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: theme.text3, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filter tabs ── */}
      <View style={{ paddingVertical: 10 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          data={[
            { key: 'all', label: 'All' },
            { key: 'fav', label: '⭐ Favs' },
            { key: 'recent', label: '🕐 Recent' },
            ...vault.folders.map(f => ({ key: f.id, label: `${f.icon} ${f.name}` })),
            { key: 'archive', label: '📦 Archive' },
          ]}
          keyExtractor={i => i.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilter(item.key)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: filter === item.key ? theme.accent : theme.bg3,
                borderWidth: 1,
                borderColor: filter === item.key ? theme.accent : theme.border,
              }}
            >
              <Text style={{
                color: filter === item.key ? '#fff' : theme.text2,
                fontSize: 13, fontWeight: '600',
              }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Type chips + Sort ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 }}>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={['all', 'Login', 'Card', 'WiFi', 'Note', 'Other']}
          keyExtractor={i => i}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setTypeFilter(item)}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, marginRight: 6,
                borderRadius: 12,
                backgroundColor: typeFilter === item ? theme.bg4 : 'transparent',
              }}
            >
              <Text style={{
                color: typeFilter === item ? theme.text : theme.text3,
                fontSize: 12, fontWeight: '600',
              }}>
                {item === 'all' ? 'All types' : ENTRY_TYPE_META[item as keyof typeof ENTRY_TYPE_META]?.label || item}
              </Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity
          onPress={() => setSortMode(nextSort[sortMode])}
          style={{
            backgroundColor: theme.bg3, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 5,
            borderWidth: 1, borderColor: theme.border,
          }}
        >
          <Text style={{ color: theme.text2, fontSize: 12, fontWeight: '600' }}>
            ↕ {sortLabels[sortMode]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Entry list ── */}
      {entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>
            {search ? '🔍' : filter === 'fav' ? '⭐' : '🔑'}
          </Text>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            {search ? 'No results found' : filter === 'fav' ? 'No favourites yet' : 'No entries yet'}
          </Text>
          <Text style={{ color: theme.text2, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            {search ? 'Try a different search term' : 'Tap + to add your first entry'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.id}
          renderItem={renderEntry}
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Lock button ── */}
      <TouchableOpacity
        onPress={() => { lockVault(); router.replace('/lock'); }}
        style={{
          position: 'absolute', bottom: 24, right: 24,
          backgroundColor: theme.bg3,
          borderWidth: 1, borderColor: theme.border,
          borderRadius: 30, paddingHorizontal: 18, paddingVertical: 12,
          flexDirection: 'row', alignItems: 'center', gap: 8,
          shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
        }}
      >
        <Text style={{ color: theme.text2, fontSize: 16 }}>🔒</Text>
        <Text style={{ color: theme.text2, fontWeight: '600', fontSize: 14 }}>Lock</Text>
      </TouchableOpacity>

      {/* ── Long-press action sheet ── */}
      <ActionSheet
        visible={!!actionEntry}
        onClose={() => setActionEntry(null)}
        title={actionEntry?.title}
        actions={[
          {
            label: actionEntry?.favourite ? 'Remove Favourite' : 'Add to Favourites',
            icon: '⭐',
            onPress: () => actionEntry && toggleFav(actionEntry),
          },
          {
            label: 'Edit',
            icon: '✏️',
            onPress: () => actionEntry && router.push({ pathname: '/entry/[id]/edit', params: { id: actionEntry.id } }),
          },
          {
            label: actionEntry?.archived ? 'Unarchive' : 'Archive',
            icon: '📦',
            onPress: () => actionEntry && toggleArchive(actionEntry),
          },
          {
            label: 'Delete',
            icon: '🗑',
            danger: true,
            onPress: () => setDeleteTarget(actionEntry),
          },
        ]}
      />

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Entry?"
        body={`"${deleteTarget?.title}" will be permanently deleted and cannot be recovered.`}
        onConfirm={() => { deleteTarget && deleteEntry(deleteTarget); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast />
      <LoadingOverlay />
    </View>
  );
}
