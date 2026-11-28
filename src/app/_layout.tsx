import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { HexProvider } from '../hexfort/state/HexState';
import { MareasProvider } from '../mareas/state/MareasState';
import { AppStateProvider } from '../state/AppState';
import { colors } from '../ui/theme';

export default function RootLayout() {
  return (
    <AppStateProvider>
      <HexProvider>
        <MareasProvider>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'fade',
              }}
            />
          </View>
        </MareasProvider>
      </HexProvider>
    </AppStateProvider>
  );
}
