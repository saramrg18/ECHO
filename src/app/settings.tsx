import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppState } from '../state/AppState';
import { Button } from '../ui/components/Button';
import { Screen, TopBar } from '../ui/components/Screen';
import { ToggleRow } from '../ui/components/Toggle';
import { HowToPlay } from '../ui/components/HowToPlay';
import { colors, radius } from '../ui/theme';

export default function SettingsScreen() {
  const { settings, updateSettings, resetProgress } = useAppState();
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen>
      <TopBar title="Ajustes" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <ToggleRow label="Sonido" value={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
          <View style={styles.sep} />
          <ToggleRow label="Vibración" value={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
          <View style={styles.sep} />
          <ToggleRow
            label="Botones direccionales"
            detail="Los gestos sobre el tablero siempre funcionan"
            value={settings.showDpad}
            onChange={(v) => updateSettings({ showDpad: v })}
          />
        </View>

        <Text style={styles.section}>Cómo jugar</Text>
        <View style={styles.card}>
          <HowToPlay />
        </View>

        <Text style={styles.section}>Progreso</Text>
        <View style={[styles.card, { paddingVertical: 16, gap: 12 }]}>
          {confirm ? (
            <>
              <Text style={styles.warn}>Se borrarán todos los niveles completados. ¿Seguro?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Cancelar" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
                <Button
                  label="Borrar"
                  style={{ flex: 1, borderColor: colors.danger }}
                  onPress={() => {
                    resetProgress();
                    setConfirm(false);
                  }}
                />
              </View>
            </>
          ) : (
            <Button label="Borrar progreso" onPress={() => setConfirm(true)} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.border },
  sep: { height: 1, backgroundColor: colors.border },
  section: { color: colors.textDim, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginTop: 16, marginLeft: 4 },
  warn: { color: colors.text, fontSize: 15 },
});
