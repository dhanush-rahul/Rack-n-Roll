import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { AuthPromptModal } from '../AuthPromptModal';
import { useTheme } from '../../context/ThemeContext';
import { useMenuDrawer } from '../../context/MenuDrawerContext';
import { useAuth } from '../../context/AuthContext';
import { useSignOutRequest } from '../../context/SignOutContext';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { navigateToCreateFlow } from '../../utils/navigateToCreateFlow';

const APP_NAME = 'Rack-N-Roll';

function DrawerDivider({ color }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: 12 }} />;
}

function DrawerLink({ label, icon, onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 4,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <AppIcon name={icon} size={20} color={colors.textMuted} />
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function AppMenuDrawer({ navigation }) {
  const { isOpen, closeMenu } = useMenuDrawer();
  const { colors, isDark, toggleMode } = useTheme();
  const { isAuthenticated } = useAuth();
  const { requestSignOut } = useSignOutRequest();
  const { requireAuth, authPromptProps } = useRequireAuth(navigation);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(1)).current;
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = Math.round(screenWidth * 0.35);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [isOpen, slideAnim]);

  const navigateFromDrawer = (screen, params) => {
    closeMenu();
    if (screen === 'MainTabs') {
      navigation.navigate('MainTabs', params);
      return;
    }
    navigation.navigate(screen, params);
  };

  const guardedNavigate = (screen, params, message, action, returnTo) => {
    closeMenu();
    requireAuth(
      () => {
        if (typeof action === 'function') {
          action();
          return;
        }
        if (screen === 'MainTabs') {
          navigation.navigate('MainTabs', params);
          return;
        }
        navigation.navigate(screen, params);
      },
      {
        message,
        returnTo:
          returnTo ||
          (screen === 'MainTabs'
            ? { screen: 'MainTabs', params: params || { screen: 'Discover' } }
            : screen
              ? { screen }
              : { screen: 'MainTabs', params: { screen: 'Discover' } }),
      }
    );
  };

  const openCreateTournament = useCallback(async () => {
    closeMenu();
    await navigateToCreateFlow(navigation);
  }, [closeMenu, navigation]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, drawerWidth],
  });

  return (
    <>
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.drawerOverlay }} onPress={closeMenu} />
          <Animated.View
            style={{
              width: drawerWidth,
              transform: [{ translateX }],
              backgroundColor: colors.surface,
              borderLeftWidth: 1,
              borderLeftColor: colors.borderLight,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 18,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{APP_NAME}</Text>
              <Pressable onPress={closeMenu} hitSlop={8}>
                <AppIcon name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <DrawerDivider color={colors.borderLight} />

            <ScrollView showsVerticalScrollIndicator={false}>
              <DrawerLink
                label="Discover"
                icon="discover"
                colors={colors}
                onPress={() => navigateFromDrawer('MainTabs', { screen: 'Discover' })}
              />
              <DrawerLink
                label="My Events"
                icon="trophy"
                colors={colors}
                onPress={() =>
                  guardedNavigate('MainTabs', { screen: 'MyTournaments' }, 'Sign in to view your events.')
                }
              />
              <DrawerLink
                label="Create Tournament"
                icon="plus"
                colors={colors}
                onPress={() =>
                  guardedNavigate(null, null, 'Sign in to host a tournament.', openCreateTournament, {
                    screen: 'MainTabs',
                    params: { screen: 'CreateTab' },
                  })
                }
              />
              <DrawerLink
                label="Profile"
                icon="person"
                colors={colors}
                onPress={() => guardedNavigate('MainTabs', { screen: 'Profile' }, 'Sign in to view your profile.')}
              />

              <DrawerDivider color={colors.borderLight} />

              <DrawerLink
                label="Settings"
                icon="settings"
                colors={colors}
                onPress={() =>
                  guardedNavigate('Settings', undefined, 'Sign in to open settings.', null, { screen: 'Settings' })
                }
              />
              <DrawerLink
                label="Player Card"
                icon="qr"
                colors={colors}
                onPress={() =>
                  guardedNavigate('PlayerCard', undefined, 'Sign in to view your player card.', null, {
                    screen: 'PlayerCard',
                  })
                }
              />
              <DrawerLink
                label="Help"
                icon="help"
                colors={colors}
                onPress={() => {
                  closeMenu();
                  navigation.navigate('Help');
                }}
              />
              {isAuthenticated ? (
                <DrawerLink
                  label="Logout"
                  icon="logout"
                  colors={colors}
                  onPress={() => {
                    closeMenu();
                    requestSignOut();
                  }}
                />
              ) : null}

              <DrawerDivider color={colors.borderLight} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <AppIcon name={isDark ? 'moon' : 'sun'} size={20} color={colors.textMuted} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Dark mode</Text>
                </View>
                <Switch value={isDark} onValueChange={toggleMode} trackColor={{ false: '#cbd5e1', true: colors.primary }} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                <AppIcon name="language" size={20} color={colors.textMuted} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>Language</Text>
                <Text style={{ marginLeft: 'auto', fontSize: 14, color: colors.textMuted }}>English</Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
      <AuthPromptModal {...authPromptProps} />
    </>
  );
}
