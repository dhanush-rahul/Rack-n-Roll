import React from 'react';
import { Animated } from 'react-native';

export function SkeletonCard({ pulse, height = 132, borderRadius = 16 }) {
  return (
    <Animated.View
      style={{
        height,
        borderRadius,
        backgroundColor: '#e2e8f0',
        opacity: pulse
          ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.75] })
          : 0.6,
      }}
    />
  );
}
