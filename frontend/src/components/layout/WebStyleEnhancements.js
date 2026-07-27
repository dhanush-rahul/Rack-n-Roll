import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

function buildWebStyles(colors) {
  return `
  html, body, #root {
    height: 100%;
    min-height: 100%;
  }

  body {
    margin: 0;
    background: ${colors.backgroundAlt || colors.background};
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  input, textarea, select {
    font-size: 16px;
  }

  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active,
  textarea:-webkit-autofill,
  textarea:-webkit-autofill:hover,
  textarea:-webkit-autofill:focus,
  textarea:-webkit-autofill:active,
  select:-webkit-autofill,
  select:-webkit-autofill:hover,
  select:-webkit-autofill:focus,
  select:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px ${colors.surfaceAlt || colors.inputFill} inset !important;
    box-shadow: 0 0 0 1000px ${colors.surfaceAlt || colors.inputFill} inset !important;
    -webkit-text-fill-color: ${colors.text} !important;
    caret-color: ${colors.text};
    transition: background-color 99999s ease-out 0s;
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
    outline: 2px solid ${colors.primary};
    outline-offset: 2px;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 999px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Keep bottom tab bar clipped to the page column (not full viewport). */
  #racknroll-tab-bar-shell,
  #racknroll-tab-bar-shell > div,
  #racknroll-tab-bar-panel {
    overflow: visible !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  #racknroll-tab-bar-panel > div > div {
    position: relative !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  #racknroll-tab-bar-panel [role="tablist"] {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
`;
}

export function WebStyleEnhancements() {
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const styleId = 'racknroll-web-styles';
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = buildWebStyles(colors);

    return undefined;
  }, [colors]);

  return null;
}
