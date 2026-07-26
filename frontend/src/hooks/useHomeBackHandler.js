import { useCallback, useRef, useState } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ignoreNextHardwareBackRef } from '../utils/navigationGuard';

const BACK_PRESS_INTERVAL_MS = 2000;

export function useHomeBackHandler({ enabled = true } = {}) {
  const navigation = useNavigation();
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const lastBackPressRef = useRef(0);

  const handleBackPress = useCallback(() => {
    if (ignoreNextHardwareBackRef.current) {
      ignoreNextHardwareBackRef.current = false;
      return false;
    }

    const parent = navigation.getParent();
    if (parent?.canGoBack?.()) {
      return false;
    }

    const now = Date.now();

    if (now - lastBackPressRef.current < BACK_PRESS_INTERVAL_MS) {
      setExitConfirmVisible(true);
      lastBackPressRef.current = 0;
      return true;
    }

    lastBackPressRef.current = now;
    if (Platform.OS === 'android') {
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
    }

    return true;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || Platform.OS !== 'android') {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => subscription.remove();
    }, [enabled, handleBackPress])
  );

  const confirmExit = useCallback(() => {
    setExitConfirmVisible(false);
    BackHandler.exitApp();
  }, []);

  const cancelExit = useCallback(() => {
    setExitConfirmVisible(false);
  }, []);

  return { exitConfirmVisible, confirmExit, cancelExit };
}
