const parsePositiveInteger = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const trimString = (value, fallback = '') => String(value || fallback).trim();

const appVersionConfig = {
  latestVersion: trimString(process.env.APP_LATEST_VERSION, '1.3.3'),
  minAndroidVersionCode: parsePositiveInteger(process.env.APP_MIN_ANDROID_VERSION_CODE, 18),
  minIosBuildNumber: parsePositiveInteger(process.env.APP_MIN_IOS_BUILD_NUMBER, 18),
  minWebVersion: trimString(process.env.APP_MIN_WEB_VERSION, '1.3.3'),
  androidStoreUrl: trimString(
    process.env.APP_ANDROID_STORE_URL,
    'https://play.google.com/store/apps/details?id=com.dhanushcharipally.racknroll'
  ),
  iosStoreUrl: trimString(process.env.APP_IOS_STORE_URL, ''),
  updateMessage: trimString(
    process.env.APP_UPDATE_MESSAGE,
    'A new version of Rack n Roll is available. Please update to get the latest fixes and features.'
  ),
  mandatoryMessage: trimString(
    process.env.APP_MANDATORY_UPDATE_MESSAGE,
    'This version is no longer supported. Update now to keep using Rack n Roll.'
  ),
};

module.exports = { appVersionConfig, parsePositiveInteger };
