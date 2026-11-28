import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Btn } from './Btn';
import { mt } from './theme';

export const RULES: { icon: string; title: string; text: string }[] = [
  {
    icon: '🗼',
    title: 'Apaga el faro rival',
    text: 'Cada uno tiene una isla con su faro. Gana quien apague antes el del otro. Si se acaban los 3 minutos, gana quien tenga más luz.',
  },
  {
    icon: '🏖️',
    title: 'Marea baja: criaturas',
    text: 'La arena queda al descubierto y las criaturas cruzan por los tres caminos.',
  },
  {
    icon: '🌊',
    title: 'Marea alta: barcos',
    text: 'El agua cubre la arena y salen los barcos. Las criaturas que sigan en la arena se ahogan.',
  },
  {
    icon: '⏱️',
    title: 'Cambia cada 20 segundos',
    text: 'El reloj de arriba te avisa. Si juegas una carta con la marea "equivocada", espera en tu playa hasta su marea.',
  },
  {
    icon: '⚡',
    title: 'Energía',
    text: 'Se carga sola. Cada carta cuesta de 1 a 6. En el último minuto se carga el doble de rápido.',
  },
  { icon: '🃏', title: 'Tu mazo', text: 'Llevas 8 cartas y tienes 4 en la mano. Al jugar una, entra la siguiente.' },
];

export function RulesPanel({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Cómo se juega</Text>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
        {RULES.map((r) => (
          <View key={r.title} style={styles.row}>
            <Text style={styles.icon}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowText}>{r.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <Btn label="Entendido" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: mt.panel,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 440,
    borderWidth: 2,
    borderColor: mt.border,
  },
  title: { color: mt.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: 28, width: 36, textAlign: 'center' },
  rowTitle: { color: mt.text, fontWeight: '900', fontSize: 15 },
  rowText: { color: mt.dim, fontSize: 14, lineHeight: 19 },
});
