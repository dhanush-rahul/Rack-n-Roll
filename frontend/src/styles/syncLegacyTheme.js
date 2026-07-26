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

  tournamentUi.screen.backgroundColor = themeColors.background;
  tournamentUi.card.borderColor = themeColors.border;
  tournamentUi.card.backgroundColor = themeColors.surface;
  tournamentUi.input.borderColor = themeColors.border;
  tournamentUi.input.color = themeColors.text;
  tournamentUi.input.backgroundColor = themeColors.inputFill;
  tournamentUi.modalCard.backgroundColor = themeColors.surface;
  tournamentUi.modalCard.borderColor = themeColors.cardBorder;
  tournamentUi.modalTitle.color = themeColors.text;
  tournamentUi.modalMessage.color = themeColors.textMuted;
  tournamentUi.modalOverlay.backgroundColor = themeColors.drawerOverlay;
  tournamentUi.primaryButton.backgroundColor = themeColors.primary;
  tournamentUi.primaryButtonText.color = themeColors.onPrimary;
  tournamentUi.successText.color = themeColors.success;

  discoverUi.hero.backgroundColor = themeColors.heroBg;
  discoverUi.heroGlow.backgroundColor = themeColors.heroGlow;
  discoverUi.surfaceCard.borderColor = themeColors.cardBorder;
  discoverUi.surfaceCard.backgroundColor = themeColors.surface;
  discoverUi.listCard.borderColor = themeColors.cardBorder;
  discoverUi.listCard.backgroundColor = themeColors.surface;
  discoverUi.metaIcon.backgroundColor = themeColors.inputFill;

  authUi.linkText.color = themeColors.primary;
  authUi.mutedText.color = themeColors.textMuted;
  authUi.formTitle.color = themeColors.text;
  authUi.formSubtitle.color = themeColors.textMuted;
  authUi.fieldLabel.color = themeColors.text;
  authUi.mobileIntroEyebrow.color = themeColors.primary;
  authUi.mobileIntroSubtitle.color = themeColors.textMuted;
  authUi.hintText.color = themeColors.textMuted;
  authUi.matchOk.color = themeColors.success;
  authUi.matchBad.color = themeColors.error;
  authUi.screen.backgroundColor = themeColors.backgroundAlt;
  authUi.hero.backgroundColor = themeColors.heroBg;
  authUi.heroGlow.backgroundColor = themeColors.heroGlow;
  authUi.heroEyebrow.color = themeColors.heroSubtext;
  authUi.heroTitle.color = themeColors.heroText;
  authUi.heroSubtitle.color = themeColors.heroSubtext;
  authUi.sidePanel.backgroundColor = themeColors.heroBg;
  authUi.sideFeatureList.borderTopColor = themeColors.heroDivider;
  authUi.formCard.borderColor = themeColors.borderLight;
  authUi.formCard.backgroundColor = themeColors.surface;
  authUi.input.backgroundColor = themeColors.surfaceAlt;
  authUi.input.borderColor = themeColors.border;
  authUi.input.color = themeColors.text;
  authUi.inputError.borderColor = themeColors.errorInputBorder;
  authUi.inputError.backgroundColor = themeColors.errorSurface;
  authUi.errorBanner.backgroundColor = themeColors.errorSurface;
  authUi.errorBanner.borderColor = themeColors.errorBorder;
  authUi.errorBannerText.color = themeColors.error;
  authUi.successBanner.backgroundColor = themeColors.successSurface;
  authUi.successBanner.borderColor = themeColors.successBorder;
  authUi.landingImageCard.backgroundColor = themeColors.heroBg;
  authUi.landingImageOverlay.backgroundColor =
    mode === 'dark' ? 'rgba(15, 20, 28, 0.88)' : 'rgba(15, 23, 42, 0.78)';
  authUi.featureIcon.backgroundColor = themeColors.heroStatBg;
}
