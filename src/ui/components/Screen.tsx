import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Arrow } from './Icon';
import { Tap } from './Pressable';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Tap accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} style={styles.back} hitSlop={10}>
          <Arrow dir="left" size={18} color={colors.text} />
        </Tap>
      ) : (
        <View style={styles.back} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.back, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '600', letterSpacing: 0.5 },
});
