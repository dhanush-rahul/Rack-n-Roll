import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { legalUrls } from '../../config/legalUrls';
import { authUi } from '../../styles/authUi';
import { tournamentColors } from '../../styles/tournamentUi';
import { openLegalUrl } from '../../utils/openLegalUrl';

function LegalLink({ label, url, textStyle }) {
  return (
    <Pressable
      onPress={() => openLegalUrl(url, label)}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function LegalFooter({ variant = 'auth', style }) {
  const isAuth = variant === 'auth';

  return (
    <View style={[{ alignItems: 'center', gap: 6 }, style]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        <LegalLink
          label="Terms and Conditions"
          url={legalUrls.termsAndConditions}
          textStyle={isAuth ? authUi.linkText : { color: tournamentColors.primary, fontWeight: '700', fontSize: 13 }}
        />
        <Text style={{ color: isAuth ? tournamentColors.textMuted : '#94a3b8', fontSize: 13 }}>·</Text>
        <LegalLink
          label="Privacy Policy"
          url={legalUrls.privacyPolicy}
          textStyle={isAuth ? authUi.linkText : { color: tournamentColors.primary, fontWeight: '700', fontSize: 13 }}
        />
      </View>
    </View>
  );
}

export function LegalConsent({ checked, onToggle, error }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: error ? '#fca5a5' : '#e5e7eb',
          backgroundColor: error ? '#fef2f2' : '#f8fafc',
        }}
      >
        <Pressable
          onPress={() => onToggle(!checked)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          hitSlop={8}
        >
          <AppIcon
            name={checked ? 'checkboxOn' : 'checkboxOff'}
            size={22}
            color={checked ? tournamentColors.primary : tournamentColors.textMuted}
          />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: tournamentColors.text }}>
          I agree to the{' '}
          <Text
            style={{ color: tournamentColors.primary, fontWeight: '700' }}
            onPress={() => openLegalUrl(legalUrls.termsAndConditions, 'Terms and Conditions')}
          >
            Terms and Conditions
          </Text>{' '}
          and{' '}
          <Text
            style={{ color: tournamentColors.primary, fontWeight: '700' }}
            onPress={() => openLegalUrl(legalUrls.privacyPolicy, 'Privacy Policy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
      {Boolean(error) && <Text style={authUi.fieldError}>{error}</Text>}
    </View>
  );
}

export function LegalMenuSection() {
  const rows = [
    { label: 'Terms and Conditions', url: legalUrls.termsAndConditions },
    { label: 'Privacy Policy', url: legalUrls.privacyPolicy },
  ];

  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, index) => (
        <Pressable
          key={row.label}
          onPress={() => openLegalUrl(row.url, row.label)}
          accessibilityRole="link"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            paddingHorizontal: 4,
            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
            borderBottomColor: '#f1f5f9',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: tournamentColors.text }}>{row.label}</Text>
          <Text style={{ fontSize: 18, color: tournamentColors.textMuted }}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}
