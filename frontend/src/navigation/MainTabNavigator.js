import React, { useCallback, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { AppIcon } from '../components/ui/AppIcon';
import { ConfirmModal } from '../components/ConfirmModal';
import { useTheme } from '../context/ThemeContext';
import { useMenuDrawer } from '../context/MenuDrawerContext';
import { useAuth } from '../context/AuthContext';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useHomeBackHandler } from '../hooks/useHomeBackHandler';
import { markIgnoreNextPopState } from '../utils/navigationGuard';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { MyTournamentsScreen } from '../screens/MyTournamentsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CreateTournamentScreen } from '../screens/CreateTournamentScreen';
import { CenteredWebTabBar } from '../components/navigation/CenteredWebTabBar';
import { TAB_BAR_BASE_HEIGHT, WEB_TAB_BAR_FAB_CLEARANCE } from '../hooks/useTabScreenInsets';

const Tab = createBottomTabNavigator();

function EmptyTabScreen() {
  return <View style={{ flex: 1 }} />;
}

function TabBarIcon({ name, label, focused, colors }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 56 }}>
      <AppIcon name={name} size={22} color={focused ? colors.tabActive : colors.tabInactive} />
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '600',
          color: focused ? colors.tabActive : colors.tabInactive,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ElevatedCreateButton({ onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        top: -18,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: colors.tabBar,
        shadowColor: '#000',
        shadowOpacity: colors.mode === 'dark' ? 0.35 : 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        opacity: pressed ? 0.88 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel="Create tournament"
    >
      <AppIcon name="plus" size={28} color={colors.white} />
    </Pressable>
  );
}

export function MainTabNavigator() {
  const stackNavigation = useNavigation();
  const { colors } = useTheme();
  const { isOpen, toggleMenu } = useMenuDrawer();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { exitConfirmVisible, confirmExit, cancelExit } = useHomeBackHandler();
  const markTabNavigation = useCallback(() => {
    if (Platform.OS === 'web') {
      markIgnoreNextPopState();
    }
  }, []);
  const [authPromptProps, setAuthPromptProps] = useState({
    visible: false,
    title: 'Sign in required',
    message: '',
    returnTo: null,
  });

  const showAuthPrompt = useCallback(({ message, returnTo, title }) => {
    setAuthPromptProps({
      visible: true,
      title: title || 'Sign in required',
      message: message || 'Sign in or create an account to continue.',
      returnTo: returnTo || null,
    });
  }, []);

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptProps((current) => ({ ...current, visible: false }));
  }, []);

  const requireAuthAction = useCallback(
    (action, options = {}) => {
      if (isAuthenticated) {
        action?.();
        return true;
      }
      showAuthPrompt(options);
      return false;
    },
    [isAuthenticated, showAuthPrompt]
  );

  return (
    <>
      <Tab.Navigator
        key={`tabs-${colors.mode}`}
        tabBar={(props) => <CenteredWebTabBar {...props} />}
        sceneContainerStyle={Platform.OS === 'web' ? { overflow: 'visible' } : undefined}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            height:
              TAB_BAR_BASE_HEIGHT +
              insets.bottom +
              (Platform.OS === 'web' ? WEB_TAB_BAR_FAB_CLEARANCE : 0),
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: 0,
            borderTopWidth: 0,
            overflow: 'visible',
            ...(Platform.OS === 'web'
              ? {
                  backgroundColor: 'transparent',
                  position: 'relative',
                  left: 'auto',
                  right: 'auto',
                  bottom: 'auto',
                  width: '100%',
                  maxWidth: '100%',
                }
              : {
                  backgroundColor: colors.tabBar,
                  borderTopWidth: 1,
                  borderTopColor: colors.tabBarBorder,
                  position: 'relative',
                  left: undefined,
                  right: undefined,
                  bottom: undefined,
                  elevation: 12,
                  shadowColor: '#000',
                  shadowOpacity: colors.mode === 'dark' ? 0.4 : 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: -4 },
                }),
          },
        }}
      >
        <Tab.Screen
          name="Discover"
          component={DiscoverScreen}
          listeners={{
            tabPress: markTabNavigation,
          }}
          options={{
            tabBarIcon: ({ focused }) => <TabBarIcon name="discover" label="Discover" focused={focused} colors={colors} />,
          }}
        />
        <Tab.Screen
          name="MyTournaments"
          component={MyTournamentsScreen}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              markTabNavigation();
              if (!isAuthenticated) {
                event.preventDefault();
                showAuthPrompt({
                  message: 'Sign in to view your tournaments.',
                  returnTo: { screen: 'MainTabs', params: { screen: 'MyTournaments' } },
                });
              }
            },
          })}
          options={{
            tabBarIcon: ({ focused }) => <TabBarIcon name="trophy" label="My Events" focused={focused} colors={colors} />,
          }}
        />
        <Tab.Screen
          name="CreateTab"
          component={CreateTournamentScreen}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              markTabNavigation();
              if (!isAuthenticated) {
                event.preventDefault();
                showAuthPrompt({
                  message: 'Sign in to host a tournament.',
                  returnTo: { screen: 'MainTabs', params: { screen: 'CreateTab' } },
                });
              }
            },
          })}
          options={{
            tabBarIcon: () => null,
            tabBarButton: (props) => (
              <View style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
                <ElevatedCreateButton
                  onPress={() => {
                    if (!isAuthenticated) {
                      showAuthPrompt({
                        message: 'Sign in to host a tournament.',
                        returnTo: { screen: 'MainTabs', params: { screen: 'CreateTab' } },
                      });
                      return;
                    }
                    props.onPress?.();
                  }}
                  colors={colors}
                />
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          listeners={() => ({
            tabPress: (event) => {
              markTabNavigation();
              if (!isAuthenticated) {
                event.preventDefault();
                showAuthPrompt({
                  message: 'Sign in to view your profile.',
                  returnTo: { screen: 'MainTabs', params: { screen: 'Profile' } },
                });
              }
            },
          })}
          options={{
            tabBarIcon: ({ focused }) => <TabBarIcon name="person" label="Profile" focused={focused} colors={colors} />,
          }}
        />
        <Tab.Screen
          name="MenuTab"
          component={EmptyTabScreen}
          listeners={() => ({
            tabPress: (event) => {
              markTabNavigation();
              event.preventDefault();
              toggleMenu();
            },
          })}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabBarIcon name="menu" label="Menu" focused={focused || isOpen} colors={colors} />
            ),
          }}
        />
      </Tab.Navigator>

      <AuthPromptModal
        visible={authPromptProps.visible}
        title={authPromptProps.title}
        message={authPromptProps.message}
        onCancel={closeAuthPrompt}
        onSignIn={() => {
          const returnTo = authPromptProps.returnTo;
          closeAuthPrompt();
          stackNavigation.navigate('SignIn', { returnTo });
        }}
        onSignUp={() => {
          const returnTo = authPromptProps.returnTo;
          closeAuthPrompt();
          stackNavigation.navigate('SignUp', { returnTo });
        }}
      />

      <ConfirmModal
        visible={exitConfirmVisible}
        title="Exit Rack-N-Roll?"
        message="Are you sure you want to close the app?"
        confirmLabel="Exit"
        cancelLabel="Stay"
        onConfirm={confirmExit}
        onCancel={cancelExit}
        confirmVariant="danger"
        icon="warning"
      />
    </>
  );
}
