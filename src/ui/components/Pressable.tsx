import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/** Pressable with a subtle scale-down, used by every button in the app. */
export function Tap({ style, children, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        to(0.94);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }, rest.disabled ? { opacity: 0.35 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}
