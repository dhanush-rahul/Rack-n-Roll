const { appVersionConfig } = require('../config/appVersion');

const buildAppVersionPayload = () => ({
  latestVersion: appVersionConfig.latestVersion,
  minAndroidVersionCode: appVersionConfig.minAndroidVersionCode,
  minIosBuildNumber: appVersionConfig.minIosBuildNumber,
  minWebVersion: appVersionConfig.minWebVersion,
  androidStoreUrl: appVersionConfig.androidStoreUrl,
  iosStoreUrl: appVersionConfig.iosStoreUrl || null,
  updateMessage: appVersionConfig.updateMessage,
  mandatoryMessage: appVersionConfig.mandatoryMessage,
});

module.exports = { buildAppVersionPayload };
