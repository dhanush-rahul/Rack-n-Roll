const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const dryRun = process.argv.includes('--dry-run');

const readAppJson = () => JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const writeAppJson = (appJson) => {
  fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`, 'utf8');
};

const bumpVersionCode = () => {
  const appJson = readAppJson();
  appJson.expo = appJson.expo || {};
  appJson.expo.android = appJson.expo.android || {};

  const currentAndroidCode = Number(appJson.expo.android.versionCode || 0);
  const nextAndroidCode = currentAndroidCode + 1;

  let iosMessage = '';

  if (appJson.expo.ios) {
    const currentIosBuild = Number(appJson.expo.ios.buildNumber || 0);
    const nextIosBuild = currentIosBuild + 1;

    if (!dryRun) {
      appJson.expo.ios.buildNumber = String(nextIosBuild);
    }

    iosMessage = `, iOS buildNumber: ${currentIosBuild} -> ${nextIosBuild}`;
  }

  if (!dryRun) {
    appJson.expo.android.versionCode = nextAndroidCode;
    writeAppJson(appJson);
  }

  console.log(
    `[bump-version-code] Android versionCode: ${currentAndroidCode} -> ${nextAndroidCode}${iosMessage}${
      dryRun ? ' (dry run, app.json not changed)' : ''
    }`
  );

  return nextAndroidCode;
};

bumpVersionCode();
