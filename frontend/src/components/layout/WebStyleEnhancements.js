import { useEffect } from 'react';
import { Platform } from 'react-native';

const WEB_STYLES = `
  html, body, #root {
    height: 100%;
    min-height: 100%;
  }

  body {
    margin: 0;
    background: #eef2f6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  input, textarea, select {
    font-size: 16px;
  }

  [role="button"], button, a {
    cursor: pointer;
  }

  @media (hover: hover) and (pointer: fine) {
    [role="button"]:hover,
    button:hover {
      filter: brightness(0.98);
    }
  }

  *:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 999px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }
`;

export function WebStyleEnhancements() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const styleId = 'racknroll-web-styles';
    if (document.getElementById(styleId)) {
      return undefined;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = WEB_STYLES;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  return null;
}
