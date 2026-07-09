import React, { useMemo, useRef } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../tournament/TournamentChrome';
import { AppIcon } from '../ui/AppIcon';
import { authUi } from '../../styles/authUi';
import { tournamentColors } from '../../styles/tournamentUi';
import { WebTwoColumnLayout } from '../layout/WebTwoColumnLayout';
import { useResponsiveLayout, centeredContentStyle } from '../../utils/responsive';

export function AuthHero({ eyebrow, title, subtitle, compact = false }) {
  return (
    <View style={[authUi.hero, compact && { padding: 18 }]}>
      <View style={[authUi.heroGlow, { top: -30, right: -20 }]} />
      <View style={[authUi.heroGlow, { bottom: -40, left: -10, backgroundColor: 'rgba(124, 58, 237, 0.28)' }]} />
      {Boolean(eyebrow) && <Text style={authUi.heroEyebrow}>{eyebrow}</Text>}
      <Text style={[authUi.heroTitle, compact && { fontSize: 22, lineHeight: 28 }]}>{title}</Text>
      {Boolean(subtitle) && <Text style={authUi.heroSubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function AuthSidePanel({ eyebrow, title, subtitle, features = [] }) {
  const { isDesktopWeb } = useResponsiveLayout();

  if (!isDesktopWeb) {
    return (
      <View style={authUi.mobileIntro}>
        {Boolean(eyebrow) && <Text style={authUi.mobileIntroEyebrow}>{eyebrow}</Text>}
        {Boolean(subtitle) && <Text style={authUi.mobileIntroSubtitle}>{subtitle}</Text>}
      </View>
    );
  }

  return (
    <View
      style={[
        authUi.sidePanel,
        {
          width: '100%',
          position: 'relative',
          backgroundColor: '#0f172a',
        },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[authUi.heroGlow, { top: -30, right: -20 }]} />
        <View style={[authUi.heroGlow, { bottom: -40, left: -10, backgroundColor: 'rgba(124, 58, 237, 0.28)' }]} />
      </View>

      <View style={{ position: 'relative', zIndex: 1 }}>
        {Boolean(eyebrow) && <Text style={authUi.heroEyebrow}>{eyebrow}</Text>}
        <Text style={authUi.heroTitle}>{title}</Text>
        {Boolean(subtitle) && <Text style={authUi.heroSubtitle}>{subtitle}</Text>}

        {features.length > 0 ? (
          <View style={authUi.sideFeatureList}>
            {features.map((feature) => (
              <AuthFeature key={feature.title} variant="dark" {...feature} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function AuthField({
  label,
  error,
  style,
  ...textInputProps
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {Boolean(label) && <Text style={authUi.fieldLabel}>{label}</Text>}
      <TextInput
        style={[authUi.input, Boolean(error) && authUi.inputError, style]}
        placeholderTextColor={tournamentColors.placeholder}
        {...textInputProps}
      />
      {Boolean(error) && <Text style={authUi.fieldError}>{error}</Text>}
    </View>
  );
}

export function AuthErrorBanner({ message }) {
  if (!message) {
    return null;
  }

  return (
    <View style={authUi.errorBanner}>
      <Text style={authUi.errorBannerText}>{message}</Text>
    </View>
  );
}

export function AuthSuccessBanner({ message }) {
  if (!message) {
    return null;
  }

  return (
    <View style={authUi.successBanner}>
      <Text style={authUi.successBannerText}>{message}</Text>
    </View>
  );
}

export function AuthLandingHero({
  source = require('../../../assets/landing.jpeg'),
  eyebrow = 'POOL TOURNAMENTS',
  title = 'Rack n Roll',
  subtitle = 'Run brackets, track standings, and keep every match on the table.',
  imageHeight = 280,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[authUi.landingImageCard, { paddingTop: insets.top, backgroundColor: '#0f172a' }]}>
      <Image source={source} style={[authUi.landingImage, { height: imageHeight }]} resizeMode="cover" />
      <View style={authUi.landingImageOverlay}>
        {Boolean(eyebrow) && <Text style={authUi.heroEyebrow}>{eyebrow}</Text>}
        <Text style={[authUi.heroTitle, { fontSize: 28, lineHeight: 34 }]}>{title}</Text>
        {Boolean(subtitle) && <Text style={[authUi.heroSubtitle, { marginTop: 6 }]}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export function AuthStepIndicator({ steps, currentIndex }) {
  return (
    <View style={authUi.stepRow}>
      {steps.map((label, index) => {
        const active = index === currentIndex;
        const done = index < currentIndex;

        return (
          <View key={label} style={[authUi.stepPill(active, done), index > 0 ? { marginLeft: 6 } : null]}>
            <Text style={authUi.stepPillText(active, done)} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function AuthPinInput({ value, onChangeValue, onReady, error }) {
  const inputRef = useRef(null);
  const pinDigits = useMemo(() => Array.from({ length: 6 }, (_, index) => value[index] || ''), [value]);

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={authUi.fieldLabel}>6-digit PIN</Text>
      <Pressable onPress={() => inputRef.current?.focus()} style={authUi.pinRow}>
        {pinDigits.map((digit, index) => {
          const active = index === Math.min(value.length, 5);
          const filled = Boolean(digit);

          return (
            <View key={`pin-${index}`} style={authUi.pinCell(active, filled)}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: tournamentColors.text }}>{digit || '•'}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
        value={value}
        onChangeText={(next) => {
          const digits = next.replace(/\D/g, '').slice(0, 6);
          onChangeValue(digits);
          if (digits.length === 6 && onReady) {
            onReady(digits);
          }
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
      />
      {Boolean(error) && <Text style={authUi.fieldError}>{error}</Text>}
    </View>
  );
}

export function AuthPasswordMatchHint({ password, confirmPassword }) {
  const entered = Boolean(password) || Boolean(confirmPassword);

  if (!entered) {
    return null;
  }

  const matches = Boolean(password) && Boolean(confirmPassword) && password === confirmPassword;

  return (
    <Text style={matches ? authUi.matchOk : authUi.matchBad}>
      {matches ? 'Passwords match.' : 'Passwords do not match.'}
    </Text>
  );
}

export function AuthScreenShell({ children, sidePanel, keyboardVerticalOffset = 0 }) {
  const insets = useSafeAreaInsets();
  const scrollBottom = 16 + insets.bottom;
  const { contentMaxWidth, isDesktopWeb, isWeb, formMaxWidth, horizontalPadding } = useResponsiveLayout();

  const body =
    isDesktopWeb && sidePanel ? (
      <WebTwoColumnLayout left={sidePanel} right={<View style={{ gap: 16 }}>{children}</View>} leftWidth={300} gap={32} />
    ) : (
      <View style={{ gap: 16 }}>
        {sidePanel}
        {children}
      </View>
    );

  return (
    <KeyboardAvoidingView
      style={[authUi.screen, isDesktopWeb && { backgroundColor: '#eef2f6' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingBottom: scrollBottom,
            paddingHorizontal: horizontalPadding,
            paddingTop: isDesktopWeb ? 28 : 12,
          },
          isDesktopWeb && { justifyContent: 'center', minHeight: '100%' },
          isWeb ? centeredContentStyle(contentMaxWidth) : centeredContentStyle(contentMaxWidth || formMaxWidth),
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthFormCard({ title, subtitle, children }) {
  const { formMaxWidth, isDesktopWeb } = useResponsiveLayout();
  const widthStyle =
    formMaxWidth && !isDesktopWeb
      ? { maxWidth: formMaxWidth, width: '100%', alignSelf: 'center' }
      : { width: '100%' };

  return (
    <View style={[authUi.formCard, widthStyle]}>
      {Boolean(title) && <Text style={authUi.formTitle}>{title}</Text>}
      {Boolean(subtitle) && <Text style={authUi.formSubtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

export function AuthPrimaryButton({ label, onPress, disabled, loading }) {
  return (
    <View style={{ marginTop: 4 }}>
      <ActionButton label={loading ? 'Please wait…' : label} onPress={onPress} disabled={disabled || loading} fullWidth />
    </View>
  );
}

export function AuthTextLink({ prompt, actionLabel, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 14, alignItems: 'center' }}>
      <Text style={authUi.mutedText}>
        {prompt}{' '}
        <Text style={authUi.linkText}>{actionLabel}</Text>
      </Text>
    </Pressable>
  );
}

export function AuthFeature({ icon, title, description, variant = 'dark' }) {
  const isLight = variant === 'light';

  return (
    <View style={authUi.featureRow}>
      <View
        style={[
          authUi.featureIcon,
          isLight && { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe' },
        ]}
      >
        <AppIcon name={icon} size={18} color={isLight ? tournamentColors.primary : '#f8fafc'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: isLight ? tournamentColors.text : '#f8fafc',
            fontWeight: '700',
            fontSize: 14,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: isLight ? tournamentColors.textMuted : '#94a3b8',
            fontSize: 13,
            lineHeight: 18,
            marginTop: 2,
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

export function AuthDivider({ label = 'or' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: tournamentColors.borderLight }} />
      <Text style={{ color: tournamentColors.textMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: tournamentColors.borderLight }} />
    </View>
  );
}
