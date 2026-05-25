// app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { View, StatusBar } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '../src/context';
import { Toast, LoadingOverlay } from '../src/components/UI';

function RootNavigator() {
  const { setupDone, unlocked, isDark } = useApp();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Short delay to let context initialize
    const t = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inSetup = segments[0] === 'setup';
    const inLock  = segments[0] === 'lock';

    if (!setupDone) {
      if (!inSetup) router.replace('/setup');
    } else if (!unlocked) {
      if (!inLock) router.replace('/lock');
    } else {
      if (inSetup || inLock) router.replace('/');
    }
  }, [setupDone, unlocked, ready]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="setup" />
      <Stack.Screen name="lock" />
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="audit" />
      <Stack.Screen name="generator" />
      <Stack.Screen name="entry/new" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="entry/[id]/edit" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <Inner />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Inner() {
  const { isDark } = useApp();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <RootNavigator />
      <Toast />
      <LoadingOverlay />
    </View>
  );
}
