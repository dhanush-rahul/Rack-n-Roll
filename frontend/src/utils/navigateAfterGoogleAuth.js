import { navigateAfterAuth } from './navigateAfterAuth';

export function navigateAfterGoogleAuth(navigation, route, result) {
  if (result?.isNewUser) {
    navigation.navigate('ChooseUsername', {
      returnTo: route.params?.returnTo,
      initialUsername: result?.user?.username || '',
    });
    return;
  }

  navigateAfterAuth(navigation, route.params?.returnTo);
}
