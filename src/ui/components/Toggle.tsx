import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export function ToggleRow({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useState(() => new Animated.Value(value ? 1 : 0))[0];
  useEffect(() => {
    Animated.timing(t, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, t]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={styles.row}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: t.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceHigh, colors.echo] }) },
        ]}
      >
        <Animated.View
          style={[styles.knob, { transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 },
  label: { color: colors.text, fontSize: 16, fontWeight: '500' },
  detail: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: radius.pill, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.text },
});
