import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Direction } from '../../engine';

/** Geometric icons drawn with Views (no icon font dependency). */
export function Arrow({ dir, size = 16, color }: { dir: Direction; size?: number; color: string }) {
  const rot = { up: '0deg', right: '90deg', down: '180deg', left: '270deg' }[dir];
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: rot }] }}>
      <View
        style={{
          width: s * 0.5,
          height: s * 0.5,
          borderLeftWidth: Math.max(2, s * 0.14),
          borderTopWidth: Math.max(2, s * 0.14),
          borderColor: color,
          transform: [{ translateY: s * 0.12 }, { rotate: '45deg' }],
          borderTopLeftRadius: 2,
        }}
      />
    </View>
  );
}

export function PauseIcon({ size = 16, color }: { size?: number; color: string }) {
  const bar = { width: size * 0.22, height: size * 0.8, backgroundColor: color, borderRadius: 2 };
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: size * 0.2 }}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

export function UndoIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.7,
          height: size * 0.7,
          borderWidth: Math.max(2, size * 0.13),
          borderColor: color,
          borderRadius: size,
          borderLeftColor: 'transparent',
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'flex-start', justifyContent: 'flex-start' }]}>
        <View style={{ marginLeft: size * 0.02, marginTop: size * 0.18 }}>
          <Arrow dir="left" size={size * 0.5} color={color} />
        </View>
      </View>
    </View>
  );
}

export function RestartIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.74,
          height: size * 0.74,
          borderWidth: Math.max(2, size * 0.13),
          borderColor: color,
          borderTopColor: 'transparent',
          borderRadius: size,
        }}
      />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'flex-end', justifyContent: 'flex-start' }]}>
        <View style={{ marginRight: size * 0.02, marginTop: size * 0.02 }}>
          <Arrow dir="down" size={size * 0.5} color={color} />
        </View>
      </View>
    </View>
  );
}

export function LockIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: size * 0.56,
          height: size * 0.6,
          borderWidth: Math.max(1.5, size * 0.12),
          borderColor: color,
          borderBottomWidth: 0,
          borderTopLeftRadius: size,
          borderTopRightRadius: size,
        }}
      />
      <View style={{ width: size * 0.84, height: size * 0.56, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

export function CheckIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.36,
          height: size * 0.7,
          borderRightWidth: Math.max(2, size * 0.16),
          borderBottomWidth: Math.max(2, size * 0.16),
          borderColor: color,
          transform: [{ translateY: -size * 0.08 }, { rotate: '45deg' }],
        }}
      />
    </View>
  );
}
