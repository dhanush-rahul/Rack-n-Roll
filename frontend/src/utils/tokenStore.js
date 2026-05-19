import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'rack_n_roll_auth_token';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  return AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  return AsyncStorage.removeItem(TOKEN_KEY);
}
