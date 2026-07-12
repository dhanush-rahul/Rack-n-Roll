import { CommonActions, createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { AppHeaderShell } from '../components/layout/AppHeaderShell';
import { WebDesktopFooter } from '../components/layout/WebNavigationChrome';
import { SignOutProvider } from '../context/SignOutContext';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { AppIcon } from '../components/ui/AppIcon';
import { tournamentColors } from '../styles/tournamentUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ChooseUsernameScreen } from '../screens/ChooseUsernameScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { CreateTournamentScreen } from '../screens/CreateTournamentScreen';
import { CreateTournamentWalkthroughScreen } from '../screens/CreateTournamentWalkthroughScreen';
import { ScoresheetScreen } from '../screens/ScoresheetScreen';
import { LiveMatchSessionScreen } from '../screens/LiveMatchSessionScreen';
import { ScreenErrorBoundary } from '../components/ScreenErrorBoundary';
import { TournamentDetailScreen } from '../screens/TournamentDetailScreen';

function TournamentDetailScreenWithBoundary(props) {
  return (
    <ScreenErrorBoundary
      screenName="TournamentDetail"
      title="Host dashboard unavailable"
      onGoBack={() => props.navigation?.goBack?.()}
    >
      <TournamentDetailScreen {...props} />
    </ScreenErrorBoundary>
  );
}
import { AppBootstrapScreen, BOOTSTRAP_BACKGROUND } from '../screens/AppBootstrapScreen';
import { GlobalLoadingOverlay } from '../components/ui/GlobalLoadingOverlay';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DiscoverWalkthroughScreen } from '../screens/DiscoverWalkthroughScreen';
import { useWebBrowserBackGuard } from '../hooks/useWebBrowserBackGuard';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();
const HEADER_CONTROL_SIZE = 34;

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
    <AppHeaderShell>
      <View
        style={{
          paddingTop: topInset + 12,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: HEADER_CONTROL_SIZE + 24,
        }}
      >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          marginRight: 10,
          minHeight: HEADER_CONTROL_SIZE,
        }}
      >
        {showBack ? (
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.pop() : null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            android_ripple={{ color: '#ccc', borderless: true }}
            style={({ pressed }) => ({
              marginRight: 10,
              width: HEADER_CONTROL_SIZE,
              height: HEADER_CONTROL_SIZE,
              borderRadius: HEADER_CONTROL_SIZE / 2,
              borderWidth: 1,
              borderColor: '#cbd5e1',
              backgroundColor: pressed ? '#e2e8f0' : '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppIcon name="chevronLeft" size={22} color={tournamentColors.text} />
          </Pressable>
        ) : null}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ fontSize: 20, fontWeight: '600', lineHeight: 24, flexShrink: 1 }}
        >
          {displayTitle}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: HEADER_CONTROL_SIZE }}>
        {onInfoPress ? (
          <Pressable
            onPress={onInfoPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Show tour"
            style={({ pressed }) => ({
              width: HEADER_CONTROL_SIZE,
              height: HEADER_CONTROL_SIZE,
              borderRadius: HEADER_CONTROL_SIZE / 2,
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
                width: HEADER_CONTROL_SIZE,
                height: HEADER_CONTROL_SIZE,
                borderRadius: HEADER_CONTROL_SIZE / 2,
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
    </AppHeaderShell>
  );
});

const ROUTE_TITLES = {
  Home: 'Rack-N-Roll',
  DiscoverWalkthrough: 'Rack-N-Roll',
  SignIn: 'Sign In',
  SignUp: 'Create Account',
  ChooseUsername: 'Choose Username',
  ForgotPassword: 'Forgot Password',
  Profile: 'My Profile',
  CreateTournamentWalkthrough: 'Create Tournament',
  CreateTournament: 'Create Tournament',
  TournamentDetail: 'Tournament',
  Scoresheet: 'Scoresheet',
  LiveMatchSession: 'Live match',
};

function resolveRouteTitle(route) {
  if (!route?.name) {
    return 'Rack-N-Roll';
  }
  if (route.name === 'TournamentDetail' || route.name === 'Scoresheet') {
    return route.params?.tournamentName || ROUTE_TITLES[route.name];
  }
  return ROUTE_TITLES[route.name] || route.name;
}

function RootStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f8fafc' },
        // The header lives outside the navigator so it stays fixed in the
        // background while only the screen content animates underneath it.
        headerShown: false,
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
      <Stack.Screen name="ChooseUsername" component={ChooseUsernameScreen} options={{ title: 'Choose Username' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen
        name="CreateTournamentWalkthrough"
        component={CreateTournamentWalkthroughScreen}
        options={{ title: 'Create Tournament' }}
      />
      <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} options={{ title: 'Create Tournament' }} />
      <Stack.Screen
        name="TournamentDetail"
        component={TournamentDetailScreenWithBoundary}
        options={{ title: 'Tournament' }}
      />
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

  const [currentRoute, setCurrentRoute] = useState({
    name: 'Home',
    params: undefined,
    canGoBack: false,
  });

  const [isBootstrapOverlayVisible, setIsBootstrapOverlayVisible] = useState(true);
  const bootstrapOverlayOpacity = useRef(new Animated.Value(1)).current;

  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHiddenRef.current) {
      return;
    }
    nativeSplashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleNavigationStateChange = useCallback(() => {
    if (!navigationRef.isReady()) {
      return;
    }
    const route = navigationRef.getCurrentRoute();
    if (!route) {
      return;
    }
    setCurrentRoute({
      name: route.name,
      params: route.params,
      canGoBack: navigationRef.canGoBack(),
    });
  }, []);

  const headerNavigation = useMemo(
    () => ({
      canGoBack: () => navigationRef.isReady() && navigationRef.canGoBack(),
      pop: () => {
        if (navigationRef.isReady() && navigationRef.canGoBack()) {
          navigationRef.goBack();
        }
      },
      navigate: (name, params) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(name, params);
        }
      },
    }),
    []
  );

  const {
    exitConfirmVisible: webExitConfirmVisible,
    confirmExit: confirmWebExit,
    cancelExit: cancelWebExit,
  } = useWebBrowserBackGuard({
    enabled: !isLoading,
  });

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
    if (isLoading) {
      return;
    }

    hideNativeSplash();

    // Fade the splash overlay away to reveal the dashboard underneath.
    const animation = Animated.timing(bootstrapOverlayOpacity, {
      toValue: 0,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setIsBootstrapOverlayVisible(false);
      }
    });

    return () => animation.stop();
  }, [bootstrapOverlayOpacity, hideNativeSplash, isLoading]);

  const showHomeActions = currentRoute.name === 'Home' && isAuthenticated;
  const showGuestActions = currentRoute.name === 'Home' && !isAuthenticated;

  let onInfoPress;
  if (currentRoute.name === 'Home') {
    onInfoPress = () => headerNavigation.navigate('DiscoverWalkthrough');
  } else if (currentRoute.name === 'CreateTournament') {
    onInfoPress = () => headerNavigation.navigate('CreateTournamentWalkthrough');
  }

  return (
    <SignOutProvider requestSignOut={requestSignOut}>
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {!isLoading && (
          <NavigationContainer
            ref={navigationRef}
            onReady={handleNavigationStateChange}
            onStateChange={handleNavigationStateChange}
          >
            <View style={{ flex: 1 }}>
              <AppHeader
                navigation={headerNavigation}
                title={resolveRouteTitle(currentRoute)}
                showBack={currentRoute.canGoBack}
                showHomeActions={showHomeActions}
                showGuestActions={showGuestActions}
                onSignOut={requestSignOut}
                onSignIn={() => headerNavigation.navigate('SignIn', { returnTo: { screen: 'Home' } })}
                onSignUp={() => headerNavigation.navigate('SignUp', { returnTo: { screen: 'Home' } })}
                onInfoPress={onInfoPress}
              />
              <View style={{ flex: 1 }}>
                <RootStack />
              </View>
              <WebDesktopFooter />
            </View>
          </NavigationContainer>
        )}

        {isBootstrapOverlayVisible && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: bootstrapOverlayOpacity, backgroundColor: BOOTSTRAP_BACKGROUND }]}
            pointerEvents={isLoading ? 'auto' : 'none'}
          >
            <AppBootstrapScreen statusMessage={bootstrapMessage} onReady={hideNativeSplash} />
          </Animated.View>
        )}
        {!isLoading && <GlobalLoadingOverlay />}
      </View>
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
      <ConfirmModal
        visible={webExitConfirmVisible}
        title="Exit Rack-N-Roll?"
        message="Are you sure you want to leave the app?"
        confirmLabel="Exit"
        cancelLabel="Stay"
        onConfirm={confirmWebExit}
        onCancel={cancelWebExit}
        confirmVariant="danger"
        icon="warning"
      />
    </SignOutProvider>
  );
}
