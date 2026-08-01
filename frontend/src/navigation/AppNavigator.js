import { CommonActions, createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
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
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { MainTabNavigator } from './MainTabNavigator';
import { AppMenuDrawer } from '../components/navigation/AppMenuDrawer';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ChooseUsernameScreen } from '../screens/ChooseUsernameScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
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
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayerCardScreen } from '../screens/PlayerCardScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { PublicPlayerProfileScreen } from '../screens/PublicPlayerProfileScreen';
import { DiscoverWalkthroughScreen } from '../screens/DiscoverWalkthroughScreen';
import {
  getFocusedRouteName,
  getMainTabTitle,
  isMainTabScreen,
  resolveActiveTabName,
} from './navigationRouteUtils';
import { useWebBrowserBackGuard } from '../hooks/useWebBrowserBackGuard';
import { useAppHeaderMetrics } from '../hooks/useAppHeaderInsets';
import { markIgnoreNextPopState } from '../utils/navigationGuard';
import { publicProfileLinking } from './publicProfileLinking';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const AppHeader = memo(function AppHeader({
  navigation,
  title,
  showBack,
  showGuestActions = false,
  onSignIn,
  onSignUp,
  onInfoPress,
}) {
  const { colors } = useTheme();
  const { fs, sp, isDesktopWeb, isWeb } = useTypography();
  const { topInset, headerPaddingV, controlSize } = useAppHeaderMetrics();
  const titleText = String(title || '');
  const displayTitle = titleText.length > 20 ? `${titleText.slice(0, 20)}...` : titleText;
  const titleFontSize = isWeb && isDesktopWeb ? fs(17) : fs(18);
  const titleLineHeight = isWeb && isDesktopWeb ? fs(21) : fs(22);

  return (
    <AppHeaderShell>
      <View
        style={{
          paddingTop: topInset + headerPaddingV,
          paddingBottom: headerPaddingV,
          paddingLeft: sp(12),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: controlSize + headerPaddingV * 2,
        }}
      >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          marginRight: 10,
          minHeight: controlSize,
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
              width: controlSize,
              height: controlSize,
              borderRadius: controlSize / 2,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.borderLight : colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppIcon name="chevronLeft" size={sp(20)} color={colors.text} />
          </Pressable>
        ) : null}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontSize: titleFontSize,
            fontWeight: '600',
            lineHeight: titleLineHeight,
            flexShrink: 1,
            color: colors.text,
            paddingRight: sp(12),
            paddingTop: sp(6),
            paddingBottom: sp(6),
          }}
        >
          {displayTitle}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: sp(12),
          minHeight: controlSize,
          paddingRight: showGuestActions ? sp(12) : 0,
        }}
      >
        {onInfoPress ? (
          <Pressable
            onPress={onInfoPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Show tour"
            style={({ pressed }) => ({
              width: controlSize,
              height: controlSize,
              borderRadius: controlSize / 2,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppIcon name="info" size={sp(20)} color={colors.text} />
          </Pressable>
        ) : null}
        {showGuestActions && (
          <>
            <Pressable onPress={onSignIn} hitSlop={8}>
              <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>Sign in</Text>
            </Pressable>
            <Pressable
              onPress={onSignUp}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: sp(11),
                paddingVertical: sp(5),
                borderRadius: 999,
                backgroundColor: pressed ? colors.primaryMuted : colors.primary,
              })}
            >
              <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.onPrimary }}>Sign up</Text>
            </Pressable>
          </>
        )}
      </View>
      </View>
    </AppHeaderShell>
  );
});

const ROUTE_TITLES = {
  MainTabs: 'Rack-N-Roll',
  Discover: 'Rack-N-Roll',
  MyTournaments: 'My Events',
  CreateTab: 'Create Tournament',
  Profile: 'Profile',
  DiscoverWalkthrough: 'Rack-N-Roll',
  SignIn: 'Sign In',
  SignUp: 'Create Account',
  ChooseUsername: 'Choose Username',
  ForgotPassword: 'Forgot Password',
  Settings: 'Settings',
  PlayerCard: 'Player Card',
  Help: 'Help',
  PublicPlayerProfile: 'Player Card',
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
  if (route.name === 'PublicPlayerProfile') {
    return route.params?.username ? `@${route.params.username}` : ROUTE_TITLES[route.name];
  }
  return ROUTE_TITLES[route.name] || route.name;
}

function RootStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ title: 'Rack-N-Roll' }} />
      <Stack.Screen
        name="DiscoverWalkthrough"
        component={DiscoverWalkthroughScreen}
        options={{ title: 'Rack-N-Roll' }}
      />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="ChooseUsername" component={ChooseUsernameScreen} options={{ title: 'Choose Username' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="PlayerCard" component={PlayerCardScreen} options={{ title: 'Player Card' }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: 'Help' }} />
      <Stack.Screen name="PublicPlayerProfile" component={PublicPlayerProfileScreen} options={{ title: 'Player Card' }} />
      <Stack.Screen
        name="CreateTournamentWalkthrough"
        component={CreateTournamentWalkthroughScreen}
        options={{ title: 'Create Tournament' }}
      />
      <Stack.Screen
        name="TournamentDetail"
        component={TournamentDetailScreenWithBoundary}
        options={{ title: 'Tournament', animation: 'fade' }}
      />
      <Stack.Screen name="Scoresheet" component={ScoresheetScreen} options={{ title: 'Scoresheet', animation: 'fade' }} />
      <Stack.Screen name="LiveMatchSession" component={LiveMatchSessionScreen} options={{ title: 'Live match' }} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading, bootstrapMessage, signOut } = useAuth();
  const { colors } = useTheme();
  const { contentPaddingTop } = useAppHeaderMetrics();
  const nativeSplashHiddenRef = useRef(false);
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [currentRoute, setCurrentRoute] = useState({
    name: 'MainTabs',
    params: undefined,
    canGoBack: false,
    focusedRouteName: 'Discover',
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
    const rootState = navigationRef.getRootState();
    setCurrentRoute({
      name: route.name,
      params: route.params,
      canGoBack: navigationRef.canGoBack(),
      focusedRouteName: getFocusedRouteName(rootState),
    });
  }, []);

  const headerNavigation = useMemo(
    () => ({
      canGoBack: () => navigationRef.isReady() && navigationRef.canGoBack(),
      pop: () => {
        if (navigationRef.isReady() && navigationRef.canGoBack()) {
          markIgnoreNextPopState();
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
    navigationRef,
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
            routes: [{ name: 'MainTabs', params: { screen: 'Discover' } }],
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

  const activeTabName = resolveActiveTabName(
    navigationRef.isReady() ? navigationRef.getRootState() : null,
    currentRoute.name
  );
  const onMainTab = isMainTabScreen(activeTabName);
  const headerTitle = onMainTab ? getMainTabTitle(activeTabName) : resolveRouteTitle(currentRoute);
  const showBack = !onMainTab && currentRoute.canGoBack;

  let onInfoPress;
  if (activeTabName === 'CreateTab') {
    onInfoPress = () => headerNavigation.navigate('CreateTournamentWalkthrough');
  }

  const navigationTheme = useMemo(() => {
    const base = colors.mode === 'dark' ? DarkTheme : DefaultTheme;

    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.tabBar,
        text: colors.text,
        border: colors.tabBarBorder,
        notification: colors.primary,
      },
    };
  }, [colors]);

  return (
    <SignOutProvider requestSignOut={requestSignOut}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {!isLoading && (
          <NavigationContainer
            ref={navigationRef}
            theme={navigationTheme}
            linking={publicProfileLinking}
            onReady={handleNavigationStateChange}
            onStateChange={handleNavigationStateChange}
          >
            <View style={{ flex: 1 }}>
              <AppHeader
                  navigation={headerNavigation}
                  title={headerTitle}
                  showBack={showBack}
                  showGuestActions={onMainTab && !isAuthenticated}
                  onSignIn={() => headerNavigation.navigate('SignIn', { returnTo: { screen: 'MainTabs', params: { screen: 'Discover' } } })}
                  onSignUp={() => headerNavigation.navigate('SignUp', { returnTo: { screen: 'MainTabs', params: { screen: 'Discover' } } })}
                  onInfoPress={onInfoPress}
                />
              <View style={{ flex: 1, paddingTop: contentPaddingTop }}>
                <RootStack />
              </View>
              <AppMenuDrawer navigation={headerNavigation} />
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
