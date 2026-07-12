import React, { useEffect, useRef } from 'react';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export { BOOTSTRAP_BACKGROUND } from '../components/ui/LoadingScreen';

export function AppBootstrapScreen({ statusMessage = 'Starting up…', onReady }) {
  const readyNotifiedRef = useRef(false);

  const notifyReady = () => {
    if (readyNotifiedRef.current) {
      return;
    }
    readyNotifiedRef.current = true;
    onReady?.();
  };

  useEffect(() => {
    notifyReady();
  }, []);

  return (
    <LoadingScreen
      statusMessage={statusMessage}
      subtitle="This may take a moment after the app has been idle."
      onReady={notifyReady}
    />
  );
}
