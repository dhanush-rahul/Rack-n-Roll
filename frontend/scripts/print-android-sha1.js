const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageName = 'com.dhanushcharipally.racknroll';

const keystoreCandidates = [
  {
    label: 'Project debug keystore (used by expo run:android in this repo)',
    file: path.join(__dirname, '..', 'android', 'app', 'debug.keystore'),
  },
  {
    label: 'Default Android debug keystore (~/.android/debug.keystore)',
    file: path.join(process.env.USERPROFILE || process.env.HOME || '', '.android', 'debug.keystore'),
  },
];

function readSha1(keystorePath) {
  const output = execSync(
    `keytool -list -v -keystore "${keystorePath}" -alias androiddebugkey -storepass android -keypass android`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const match = output.match(/SHA1:\s*([0-9A-F:]+)/i);
  return match ? match[1].toUpperCase() : null;
}

console.log(`\nAndroid package name: ${packageName}\n`);
console.log('Add every SHA-1 below that signs a build you install to the same Android OAuth client in Google Cloud.\n');

for (const candidate of keystoreCandidates) {
  if (!fs.existsSync(candidate.file)) {
    console.log(`[skip] ${candidate.label}`);
    console.log(`       ${candidate.file}\n`);
    continue;
  }

  try {
    const sha1 = readSha1(candidate.file);
    console.log(candidate.label);
    console.log(`  keystore: ${candidate.file}`);
    console.log(`  SHA-1:    ${sha1 || '(could not read)'}\n`);
  } catch (error) {
    console.log(candidate.label);
    console.log(`  keystore: ${candidate.file}`);
    console.log(`  error:    ${error.message}\n`);
  }
}

console.log('Production / Play Store (most common fix when local sign-in works):');
console.log('  Play Console → Setup → App integrity → App signing');
console.log('  Copy "App signing key certificate" SHA-1 and add it to the Android OAuth client.');
console.log('  (Upload-key SHA-1 from Expo is NOT the certificate users get from Play Store.)\n');
console.log('Also add (from Expo dashboard → Credentials → Android upload keystore):');
console.log('  EAS upload / release SHA-1 for builds installed from EAS or Play Store.');
console.log('\nIf the app is on Google Play with Play App Signing enabled, also add the');
console.log('App signing key certificate SHA-1 from Play Console → Setup → App signing.\n');
console.log('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be the Web application OAuth client ID');
console.log('(same value as backend GOOGLE_CLIENT_ID), NOT the Android client ID.\n');
