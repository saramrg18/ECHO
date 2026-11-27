import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { findMap, isUnlocked } from '../../../hexfort/engine';
import { useHex } from '../../../hexfort/state/HexState';
import { HxButton } from '../../../hexfort/ui/HxButton';
import { MatchScreen } from '../../../hexfort/ui/MatchScreen';
import { hx } from '../../../hexfort/ui/theme';

export default function MatchRoute() {
  const { map: id } = useLocalSearchParams<{ map: string }>();
  const { ready, save } = useHex();
  const map = findMap(String(id));
  if (!ready) return <View style={{ flex: 1, backgroundColor: hx.bg }} />;
  if (!map || !isUnlocked(save, map.id)) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: hx.bg,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
        }}
      >
        <Text style={{ color: hx.text, fontSize: 18, fontWeight: '800' }}>
          {map ? 'Mapa bloqueado' : 'Mapa no encontrado'}
        </Text>
        <HxButton label="Volver" onPress={() => router.back()} />
      </View>
    );
  }
  return <MatchScreen key={map.id} map={map} />;
}
