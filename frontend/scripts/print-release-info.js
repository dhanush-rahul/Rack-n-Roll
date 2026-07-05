const path = require('path');

process.chdir(path.join(__dirname, '..'));

const appConfig = require('../app.config.js');
const expo = appConfig.expo || {};

console.log('[release-info] EAS will build with:');
console.log(`  version: ${expo.version ?? '(unset)'}`);
console.log(`  android.versionCode: ${expo.android?.versionCode ?? '(unset)'}`);
console.log(`  ios.buildNumber: ${expo.ios?.buildNumber ?? '(unset)'}`);
console.log('[release-info] Run this from the frontend/ directory before eas build.');
