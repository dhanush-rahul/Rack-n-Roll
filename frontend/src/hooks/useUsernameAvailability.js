import { useEffect, useRef, useState } from 'react';
import { checkUsernameAvailability } from '../services/authService';
import { normalizeUsername, validateUsernameFormat } from '../utils/usernameUtils';

const DEBOUNCE_MS = 400;

export function useUsernameAvailability(username, { purpose = 'signup', enabled = true } = {}) {
  const [status, setStatus] = useState('idle');
  const [reason, setReason] = useState(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setReason(null);
      return undefined;
    }

    const normalized = normalizeUsername(username);
    const formatError = validateUsernameFormat(normalized);

    if (!normalized) {
      setStatus('idle');
      setReason(null);
      return undefined;
    }

    if (formatError) {
      setStatus('invalid');
      setReason('invalid');
      return undefined;
    }

    setStatus('checking');
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timer = setTimeout(async () => {
      try {
        const result = await checkUsernameAvailability(normalized, purpose);

        if (requestIdRef.current !== requestId) {
          return;
        }

        if (result.available) {
          setStatus('available');
          setReason(null);
          return;
        }

        setStatus('unavailable');
        setReason(result.reason || 'taken');
      } catch (_error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setStatus('error');
        setReason(null);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [enabled, purpose, username]);

  return {
    status,
    reason,
    isAvailable: status === 'available',
    isChecking: status === 'checking',
  };
}
