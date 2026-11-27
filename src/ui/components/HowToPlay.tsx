import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const RULES: { color: string; title: string; text: string }[] = [
  { color: colors.player, title: 'Mueve tu pieza', text: 'Desliza sobre el tablero o usa las flechas. Llega a la salida.' },
  { color: colors.echo, title: 'Todo vuelve', text: 'Cada movimiento se repite solo tres turnos después, justo tras tu siguiente movimiento.' },
  { color: colors.textDim, title: 'Las paredes frenan el eco', text: 'Si un eco choca con un obstáculo, se pierde. Úsalo a tu favor.' },
  { color: colors.groups.a, title: 'Interruptores y puertas', text: 'Pisar un interruptor abre o cierra sus puertas. Los ecos también los pisan.' },
  { color: colors.exit, title: 'Planifica', text: 'Mira la cola de ecos: te dice qué va a pasar en los próximos turnos.' },
];

export function HowToPlay() {
  return (
    <View style={{ paddingVertical: 8 }}>
      {RULES.map((r) => (
        <View key={r.title} style={styles.row}>
          <View style={[styles.mark, { backgroundColor: r.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.text}>{r.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingVertical: 10 },
  mark: { width: 10, height: 10, borderRadius: 3, marginTop: 6 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  text: { color: colors.textDim, fontSize: 14, marginTop: 2, lineHeight: 20 },
});
