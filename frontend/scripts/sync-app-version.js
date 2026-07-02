const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const nextVersion = String(packageJson.version || '').trim();

if (!nextVersion) {
  console.error('[sync-app-version] package.json is missing a version field.');
  process.exit(1);
}

const currentVersion = String(appJson.expo?.version || '').trim();

if (currentVersion !== nextVersion) {
  appJson.expo.version = nextVersion;
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8');
  console.log(`[sync-app-version] app.json version: ${currentVersion || '(unset)'} -> ${nextVersion}`);
} else {
  console.log(`[sync-app-version] app.json version already ${nextVersion}`);
}
