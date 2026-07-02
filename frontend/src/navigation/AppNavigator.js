import { CommonActions, createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { SignOutProvider } from '../context/SignOutContext';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { AppIcon } from '../components/ui/AppIcon';
import { tournamentColors } from '../styles/tournamentUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { CreateTournamentScreen } from '../screens/CreateTournamentScreen';
import { CreateTournamentWalkthroughScreen } from '../screens/CreateTournamentWalkthroughScreen';
import { ScoresheetScreen } from '../screens/ScoresheetScreen';
import { LiveMatchSessionScreen } from '../screens/LiveMatchSessionScreen';
import { TournamentDetailScreen } from '../screens/TournamentDetailScreen';
import { AppBootstrapScreen } from '../screens/AppBootstrapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DiscoverWalkthroughScreen } from '../screens/DiscoverWalkthroughScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const AppHeader = memo(function AppHeader({
  navigation,
  title,
  showBack,
  showHomeActions = false,
  showGuestActions = false,
  onSignOut,
  onSignIn,
  onSignUp,
  onInfoPress,
}) {
  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const titleText = String(title || '');
  const displayTitle = titleText.length > 20 ? `${titleText.slice(0, 20)}...` : titleText;

  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingBottom: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#d3e0e6',
        backgroundColor: '#d3e0e6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 10 }}>
        {showBack && (
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.pop() : null)}
            hitSlop={8}
            android_ripple={{ color: '#ccc', borderless: true }}
            style={({ pressed }) => [
              {
                marginRight: 10,
                width: 30,
                height: 30,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: '#d1d5db',
                backgroundColor: 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 18, lineHeight: 20, color: '#111827', marginLeft: -1 }}>‹</Text>
          </Pressable>
        )}
        <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 20, fontWeight: '600', flexShrink: 1 }}>
          {displayTitle}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {onInfoPress ? (
          <Pressable
            onPress={onInfoPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Show tour"
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppIcon name="info" size={22} color={tournamentColors.text} />
          </Pressable>
        ) : null}
        {showGuestActions && (
          <>
            <Pressable onPress={onSignIn} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>Sign in</Text>
            </Pressable>
            <Pressable
              onPress={onSignUp}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: pressed ? '#4338ca' : '#4f46e5',
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Sign up</Text>
            </Pressable>
          </>
        )}
        {showHomeActions && (
          <>
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                backgroundColor: pressed ? '#e2e8f0' : '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <AppIcon name="person" size={20} color={tournamentColors.text} />
            </Pressable>
            <Pressable onPress={onSignOut} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sign out">
              <AppIcon name="logout" size={20} color={tournamentColors.text} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
});

function createRootStackHeader({ isAuthenticated, onSignOut }) {
  return function RootStackHeader({ navigation, route, options, back }) {
    const title = options.title || route.name;
    const showHomeActions = route.name === 'Home' && isAuthenticated;
    const showGuestActions = route.name === 'Home' && !isAuthenticated;

    let onInfoPress = route.params?.onInfoPress;
    if (typeof onInfoPress !== 'function') {
      if (route.name === 'Home') {
        onInfoPress = () => navigation.navigate('DiscoverWalkthrough');
      } else if (route.name === 'CreateTournament') {
        onInfoPress = () => navigation.navigate('CreateTournamentWalkthrough');
      } else {
        onInfoPress = undefined;
      }
    }

    return (
      <AppHeader
        navigation={navigation}
        title={title}
        showBack={Boolean(back)}
        showHomeActions={showHomeActions}
        showGuestActions={showGuestActions}
        onSignOut={onSignOut}
        onSignIn={() => navigation.navigate('SignIn', { returnTo: { screen: 'Home' } })}
        onSignUp={() => navigation.navigate('SignUp', { returnTo: { screen: 'Home' } })}
        onInfoPress={onInfoPress}
      />
    );
  };
}

function RootStack({ isAuthenticated, onSignOut }) {
  const header = useMemo(
    () => createRootStackHeader({ isAuthenticated, onSignOut }),
    [isAuthenticated, onSignOut]
  );

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f8fafc' },
        headerTitleAlign: 'left',
        header,
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Rack-N-Roll' }} />
      <Stack.Screen
        name="DiscoverWalkthrough"
        component={DiscoverWalkthroughScreen}
        options={{ title: 'Rack-N-Roll' }}
      />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen
        name="CreateTournamentWalkthrough"
        component={CreateTournamentWalkthroughScreen}
        options={{ title: 'Create Tournament' }}
      />
      <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} options={{ title: 'Create Tournament' }} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} options={{ title: 'Tournament' }} />
      <Stack.Screen name="Scoresheet" component={ScoresheetScreen} options={{ title: 'Scoresheet' }} />
      <Stack.Screen name="LiveMatchSession" component={LiveMatchSessionScreen} options={{ title: 'Live match' }} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading, bootstrapMessage, signOut } = useAuth();
  const nativeSplashHiddenRef = useRef(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }
    nativeSplashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const requestSignOut = useCallback(() => {
    setSignOutConfirmVisible(true);
  }, []);

  const handleCancelSignOut = useCallback(() => {
    if (isSigningOut) {
      return;
    }
    setSignOutConfirmVisible(false);
  }, [isSigningOut]);

  const handleConfirmSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOut();
      setSignOutConfirmVisible(false);
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          })
        );
      }
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  useEffect(() => {
    if (!isLoading) {
      hideNativeSplash();
    }
  }, [hideNativeSplash, isLoading]);

  if (isLoading) {
    return <AppBootstrapScreen statusMessage={bootstrapMessage} onReady={hideNativeSplash} />;
  }

  return (
    <SignOutProvider requestSignOut={requestSignOut}>
      <NavigationContainer ref={navigationRef}>
        <RootStack isAuthenticated={isAuthenticated} onSignOut={requestSignOut} />
      </NavigationContainer>
      <ConfirmModal
        visible={signOutConfirmVisible}
        title="Sign out?"
        message="You'll need to sign in again to host tournaments or manage your registrations."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={handleConfirmSignOut}
        onCancel={handleCancelSignOut}
        isLoading={isSigningOut}
        confirmVariant="danger"
        icon="logout"
      />
    </SignOutProvider>
  );
}
