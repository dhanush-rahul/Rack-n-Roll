import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform, Pressable, StatusBar, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { HomeScreen } from '../screens/HomeScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { CreateTournamentScreen } from '../screens/CreateTournamentScreen';
import { ScoresheetScreen } from '../screens/ScoresheetScreen';
import { TournamentDetailScreen } from '../screens/TournamentDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LandingScreen } from '../screens/LandingScreen';

const Stack = createNativeStackNavigator();

function AppHeader({ navigation, title, showBack, showHomeActions = false, onSignOut, onInfoPress }) {
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
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
            onPress={() => navigation.canGoBack() ? navigation.pop() : null}
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
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ fontSize: 20, fontWeight: '600', flexShrink: 1 }}
        >
          {displayTitle}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {onInfoPress && (
          <Pressable onPress={onInfoPress} hitSlop={8}>
            <Text style={{ fontSize: 20, lineHeight: 20, fontWeight: 'bold', color:'#000000' }}>ⓘ</Text>
          </Pressable>
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
              <Text style={{ fontSize: 17, lineHeight: 18 }}>👤</Text>
            </Pressable>
            <Pressable onPress={onSignOut} hitSlop={8} accessibilityRole="button" accessibilityLabel="Sign out">
              <Text style={{ fontSize: 18, lineHeight: 20 }}>🚪</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{
        animation: 'fade',
        stackPresentation: 'push',
        contentStyle: { backgroundColor: '#f1f5f9' },
        header: ({ navigation, route, options, back }) => {
          if (route.name === 'Landing') {
            return null;
          }

          const title = options.title || route.name;
          return (
            <AppHeader
              navigation={navigation}
              title={title}
              showBack={Boolean(back)}
            />
          );
        },
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign In' }} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Forgot Password' }}
      />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create Account' }} />
    </Stack.Navigator>
  );
}

function AppStack({ onSignOut }) {
  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'fade',
        stackPresentation: 'push',
        contentStyle: { backgroundColor: '#f8fafc' },
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '600',
        },
        header: ({ navigation, route, options, back }) => {
          const title = options.title || route.name;
          const showHomeActions = route.name === 'Home';
          const onInfoPress = route.params?.onInfoPress;
          return (
            <AppHeader
              navigation={navigation}
              title={title}
              showBack={Boolean(back)}
              showHomeActions={showHomeActions}
              onSignOut={onSignOut}
              onInfoPress={onInfoPress}
            />
          );
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Rack-N-Roll' }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen
        name="CreateTournament"
        component={CreateTournamentScreen}
        options={{ title: 'Create Tournament' }}
      />
      <Stack.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
        options={{ title: 'Tournament Detail' }}
      />
      <Stack.Screen name="Scoresheet" component={ScoresheetScreen} options={{ title: 'Scoresheet' }} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated, isLoading, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AppStack onSignOut={signOut} />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
