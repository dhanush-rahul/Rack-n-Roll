import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { AppIcon } from '../ui/AppIcon';
import { authUi } from '../../styles/authUi';
import { tournamentColors } from '../../styles/tournamentUi';

const REASON_MESSAGES = {
  taken: 'This username is already taken.',
  reserved: 'Reserved for a tournament invite.',
  invalid: 'Use 3–20 lowercase letters, numbers, or underscores.',
};

export function AuthUsernameField({
  label = 'Username',
  value,
  onChangeText,
  error,
  availabilityStatus = 'idle',
  availabilityReason,
  helperText,
  placeholder = 'Enter username',
  ...textInputProps
}) {
  const showAvailable = availabilityStatus === 'available' && !error;
  const showUnavailable = availabilityStatus === 'unavailable' && !error;
  const availabilityMessage =
    showUnavailable && availabilityReason ? REASON_MESSAGES[availabilityReason] || 'Username unavailable.' : '';

  return (
    <View style={{ marginBottom: 14 }}>
      {Boolean(label) && <Text style={authUi.fieldLabel}>{label}</Text>}
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[
            authUi.input,
            { paddingRight: 44 },
            Boolean(error) && authUi.inputError,
            showAvailable && { borderColor: '#16a34a' },
            showUnavailable && authUi.inputError,
          ]}
          placeholderTextColor={tournamentColors.placeholder}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          placeholder={placeholder}
          {...textInputProps}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 12,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          {availabilityStatus === 'checking' ? (
            <ActivityIndicator size="small" color={tournamentColors.primary} />
          ) : null}
          {showAvailable ? <AppIcon name="check" size={18} color="#16a34a" /> : null}
          {showUnavailable ? <AppIcon name="close" size={18} color="#dc2626" /> : null}
        </View>
      </View>
      {Boolean(helperText) && !error && !availabilityMessage && (
        <Text style={{ marginTop: 6, fontSize: 12, color: tournamentColors.textMuted }}>{helperText}</Text>
      )}
      {showAvailable ? <Text style={authUi.matchOk}>Username is available.</Text> : null}
      {Boolean(error) && <Text style={authUi.fieldError}>{error}</Text>}
      {!error && Boolean(availabilityMessage) ? <Text style={authUi.fieldError}>{availabilityMessage}</Text> : null}
    </View>
  );
}
