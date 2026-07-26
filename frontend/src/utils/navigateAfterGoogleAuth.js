import { navigateAfterAuth } from './navigateAfterAuth';

export async function navigateAfterGoogleAuth(navigation, route, result) {
  if (result?.isNewUser) {
    navigation.navigate('ChooseUsername', {
      returnTo: route.params?.returnTo,
      initialUsername: result?.user?.username || '',
    });
    return;
  }

  await navigateAfterAuth(navigation, route.params?.returnTo);
}
