import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { logWarning } from '../utils/errorLogger';

export class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logWarning('Screen render error', {
      screen: this.props.screenName || 'unknown',
      message: error?.message,
      componentStack: info?.componentStack,
    });
  }

  onRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = String(this.state.error?.message || 'Something went wrong on this screen.');

    return (
      <View style={[tournamentUi.screen, { padding: 20, justifyContent: 'center', gap: 14 }]}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: tournamentColors.text }}>
          {this.props.title || 'This screen crashed'}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted }}>{message}</Text>
        <ActionButton label="Try again" onPress={this.onRetry} fullWidth />
        {this.props.onGoBack ? (
          <ActionButton label="Go back" onPress={this.props.onGoBack} variant="ghost" fullWidth />
        ) : null}
      </View>
    );
  }
}
