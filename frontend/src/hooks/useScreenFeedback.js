import { useCallback, useEffect, useState } from 'react';

export function formatApiError(error, fallback = 'Something went wrong') {
  return `${error?.code || 'ERROR'} - ${error?.message || fallback}`;
}

export function useScreenFeedback({ successAutoClearMs = 4000 } = {}) {
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const showError = useCallback((message) => {
    setErrorMessage(String(message || '').trim() || 'Something went wrong');
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccessMessage(String(message || '').trim());
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const clearSuccess = useCallback(() => {
    setSuccessMessage('');
  }, []);

  const clearAll = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage('');
  }, []);

  useEffect(() => {
    if (!successMessage || !successAutoClearMs) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSuccessMessage('');
    }, successAutoClearMs);

    return () => clearTimeout(timeoutId);
  }, [successAutoClearMs, successMessage]);

  return {
    errorMessage,
    successMessage,
    showError,
    showSuccess,
    clearError,
    clearSuccess,
    clearAll,
    formatApiError,
  };
}
