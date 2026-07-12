import React from 'react';
import { View } from 'react-native';
import { SkeletonCard } from './SkeletonCard';

export function DiscoverSkeleton({ pulse }) {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map((key) => (
        <SkeletonCard key={key} pulse={pulse} />
      ))}
    </View>
  );
}
