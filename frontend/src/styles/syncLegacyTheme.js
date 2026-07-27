import { authUi } from './authUi';
import { discoverUi, tournamentColors, tournamentUi } from './tournamentUi';

const SEMANTIC_KEYS = [
  'primarySoft',
  'primaryTint',
  'surfaceAlt',
  'surfaceRaised',
  'inputFill',
  'inputDisabled',
  'errorSurface',
  'errorBorder',
  'errorInputBorder',
  'successSurface',
  'successBorder',
  'statusSuccessBg',
  'statusSuccessText',
  'statusInfoBg',
  'statusInfoText',
  'statusWarningBg',
  'statusWarningText',
  'statusNeutralBg',
  'statusNeutralText',
  'scheduleAccent',
  'heroBg',
  'heroText',
  'heroSubtext',
  'heroAccent',
  'heroGlow',
  'heroGlowAlt',
  'heroDivider',
  'liveActiveBorder',
  'liveActivePanel',
  'liveWaitingPanel',
  'liveWaitingBorder',
  'liveActiveLabel',
  'liveActiveScore',
  'liveActiveMuted',
  'liveActiveSubtext',
  'liveAccent',
  'liveAccentSoft',
  'liveCurrentBorder',
  'liveCurrentBg',
  'liveCurrentLabel',
  'liveEmptyBorder',
  'liveEmptyBg',
  'livePanelBorder',
  'liveLagBannerBg',
  'liveLagBannerBorder',
  'liveHeroGlow',
  'liveWarningText',
  'modeSelectedBg',
  'previewBorder',
  'previewBg',
  'chipSelectedBg',
  'rowStripe',
  'accentPurple',
  'accentGreen',
  'accentRed',
  'accentAmber',
  'accentBlue',
  'accentSky',
  'accentMint',
  'mutedIcon',
  'previewPill',
  'previewPillBg',
  'sectionOpenMuted',
  'selectedSoftBg',
  'heroStatBg',
  'avatarRingBg',
  'avatarRingBorder',
  'badgeHostBg',
  'badgeHostText',
  'badgeHostBorder',
  'accentLavender',
  'heroBodyText',
];

function replaceStyle(container, key, patch) {
  container[key] = { ...container[key], ...patch };
}

/**
 * Keeps legacy static tournamentUi / tournamentColors / authUi in sync with ThemeContext
 * so existing imports pick up dark mode when ThemeProvider re-renders the tree.
 */
export function syncLegacyThemePalette(themeColors, mode = 'light') {
  Object.assign(tournamentColors, {
    background: themeColors.background,
    primary: themeColors.primary,
    primaryMuted: themeColors.primaryMuted,
    border: themeColors.border,
    borderLight: themeColors.borderLight,
    cardBorder: themeColors.cardBorder,
    text: themeColors.text,
    textMuted: themeColors.textMuted,
    placeholder: themeColors.placeholder,
    error: themeColors.error,
    success: themeColors.success,
    warning: themeColors.warning,
    white: themeColors.surface,
    onPrimary: themeColors.onPrimary,
    surface: themeColors.surface,
    surfaceMuted: themeColors.surfaceMuted,
    headerBar: themeColors.headerBar,
    headerBarBorder: themeColors.headerBarBorder,
    backgroundAlt: themeColors.backgroundAlt,
  });

  SEMANTIC_KEYS.forEach((key) => {
    if (themeColors[key] !== undefined) {
      tournamentColors[key] = themeColors[key];
    }
  });

  replaceStyle(tournamentUi, 'screen', { backgroundColor: themeColors.background });
  replaceStyle(tournamentUi, 'card', {
    borderColor: themeColors.border,
    backgroundColor: themeColors.surface,
  });
  replaceStyle(tournamentUi, 'input', {
    borderColor: themeColors.border,
    color: themeColors.text,
    backgroundColor: themeColors.inputFill,
  });
  replaceStyle(tournamentUi, 'modalCard', {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.cardBorder,
  });
  replaceStyle(tournamentUi, 'modalTitle', { color: themeColors.text });
  replaceStyle(tournamentUi, 'modalMessage', { color: themeColors.textMuted });
  replaceStyle(tournamentUi, 'modalOverlay', { backgroundColor: themeColors.drawerOverlay });
  replaceStyle(tournamentUi, 'primaryButton', { backgroundColor: themeColors.primary });
  replaceStyle(tournamentUi, 'primaryButtonText', { color: themeColors.onPrimary });
  replaceStyle(tournamentUi, 'successText', { color: themeColors.success });

  replaceStyle(discoverUi, 'hero', { backgroundColor: themeColors.heroBg });
  replaceStyle(discoverUi, 'heroGlow', { backgroundColor: themeColors.heroGlow });
  replaceStyle(discoverUi, 'surfaceCard', {
    borderColor: themeColors.cardBorder,
    backgroundColor: themeColors.surface,
  });
  replaceStyle(discoverUi, 'listCard', {
    borderColor: themeColors.cardBorder,
    backgroundColor: themeColors.surface,
  });
  replaceStyle(discoverUi, 'metaIcon', { backgroundColor: themeColors.inputFill });

  replaceStyle(authUi, 'linkText', { color: themeColors.primary });
  replaceStyle(authUi, 'mutedText', { color: themeColors.textMuted });
  replaceStyle(authUi, 'formTitle', { color: themeColors.text });
  replaceStyle(authUi, 'formSubtitle', { color: themeColors.textMuted });
  replaceStyle(authUi, 'fieldLabel', { color: themeColors.text });
  replaceStyle(authUi, 'mobileIntroEyebrow', { color: themeColors.primary });
  replaceStyle(authUi, 'mobileIntroSubtitle', { color: themeColors.textMuted });
  replaceStyle(authUi, 'hintText', { color: themeColors.textMuted });
  replaceStyle(authUi, 'matchOk', { color: themeColors.success });
  replaceStyle(authUi, 'matchBad', { color: themeColors.error });
  replaceStyle(authUi, 'screen', { backgroundColor: themeColors.backgroundAlt });
  replaceStyle(authUi, 'hero', { backgroundColor: themeColors.heroBg });
  replaceStyle(authUi, 'heroGlow', { backgroundColor: themeColors.heroGlow });
  replaceStyle(authUi, 'heroEyebrow', { color: themeColors.heroSubtext });
  replaceStyle(authUi, 'heroTitle', { color: themeColors.heroText });
  replaceStyle(authUi, 'heroSubtitle', { color: themeColors.heroSubtext });
  replaceStyle(authUi, 'sidePanel', { backgroundColor: themeColors.heroBg });
  replaceStyle(authUi, 'sideFeatureList', { borderTopColor: themeColors.heroDivider });
  replaceStyle(authUi, 'formCard', {
    borderColor: themeColors.borderLight,
    backgroundColor: themeColors.surface,
  });
  replaceStyle(authUi, 'input', {
    backgroundColor: themeColors.surfaceAlt,
    borderColor: themeColors.border,
    color: themeColors.text,
  });
  replaceStyle(authUi, 'inputError', {
    borderColor: themeColors.errorInputBorder,
    backgroundColor: themeColors.errorSurface,
  });
  replaceStyle(authUi, 'errorBanner', {
    backgroundColor: themeColors.errorSurface,
    borderColor: themeColors.errorBorder,
  });
  replaceStyle(authUi, 'errorBannerText', { color: themeColors.error });
  replaceStyle(authUi, 'successBanner', {
    backgroundColor: themeColors.successSurface,
    borderColor: themeColors.successBorder,
  });
  replaceStyle(authUi, 'landingImageCard', { backgroundColor: themeColors.heroBg });
  replaceStyle(authUi, 'landingImageOverlay', {
    backgroundColor: mode === 'dark' ? 'rgba(15, 20, 28, 0.88)' : 'rgba(15, 23, 42, 0.78)',
  });
  replaceStyle(authUi, 'featureIcon', { backgroundColor: themeColors.heroStatBg });
}
