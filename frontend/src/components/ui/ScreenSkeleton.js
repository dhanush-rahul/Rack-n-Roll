import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { SkeletonCard } from './SkeletonCard';
import { tournamentColors } from '../../styles/tournamentUi';

export function ScreenSkeleton() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={{ flex: 1, backgroundColor: tournamentColors.background, padding: 16, gap: 14 }}>
      <SkeletonCard pulse={pulse} height={120} borderRadius={16} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3].map((key) => (
          <SkeletonCard key={key} pulse={pulse} height={36} borderRadius={8} />
        ))}
      </View>
      <SkeletonCard pulse={pulse} height={200} borderRadius={12} />
      <SkeletonCard pulse={pulse} height={280} borderRadius={12} />
    </View>
  );
}
