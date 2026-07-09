/**
 * Expo config plugin: large-screen / Android 16 compliance.
 *
 * Google Play flags the ML Kit "Google code scanner" activity because it is
 * declared with `android:screenOrientation="portrait"`. From Android 16 the
 * system ignores orientation/resizability restrictions on large screens, and
 * Play Console reports the restriction as a policy issue.
 *
 * The activity is contributed by a transitive dependency's manifest, so it is
 * regenerated on every `expo prebuild`. This plugin overrides the merged
 * manifest so the activity no longer locks orientation. It is a no-op if the
 * activity is not present in the final manifest.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const RESTRICTED_ACTIVITIES = [
  'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity',
];

const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';

function addToolsReplace(existingValue, attribute) {
  const parts = (existingValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.includes(attribute)) {
    parts.push(attribute);
  }
  return parts.join(',');
}

module.exports = function withLargeScreenSupport(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest?.manifest?.application?.[0];
    if (!application) {
      return config;
    }

    manifest.manifest.$ = manifest.manifest.$ || {};
    manifest.manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;

    application.activity = application.activity || [];

    RESTRICTED_ACTIVITIES.forEach((activityName) => {
      let activity = application.activity.find(
        (entry) => entry?.$?.['android:name'] === activityName
      );

      if (!activity) {
        activity = { $: { 'android:name': activityName } };
        application.activity.push(activity);
      }

      activity.$['android:screenOrientation'] = 'unspecified';
      activity.$['tools:replace'] = addToolsReplace(
        activity.$['tools:replace'],
        'android:screenOrientation'
      );
    });

    return config;
  });
};
