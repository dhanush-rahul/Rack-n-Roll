const { execSync } = require('child_process');
const path = require('path');

const frontendRoot = path.join(__dirname, '..');
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://rack-n-roll.onrender.com';

const env = {
  ...process.env,
  EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
  NODE_ENV: 'production',
};

if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim()) {
  console.warn(
    'Warning: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Google Sign-In will not work on the deployed web app.'
  );
}

console.log(`Building web export with EXPO_PUBLIC_API_BASE_URL=${apiBaseUrl}`);

execSync('npx expo export --platform web', {
  cwd: frontendRoot,
  env,
  stdio: 'inherit',
});

console.log('\nWeb build complete. Static files are in frontend/dist/');
