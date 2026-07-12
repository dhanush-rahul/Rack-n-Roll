const { buildAppVersionPayload } = require('../../src/services/appVersion.service');

describe('appVersion.service', () => {
  test('buildAppVersionPayload returns version requirements', () => {
    const payload = buildAppVersionPayload();

    expect(payload).toMatchObject({
      latestVersion: expect.any(String),
      minAndroidVersionCode: expect.any(Number),
      minIosBuildNumber: expect.any(Number),
      minWebVersion: expect.any(String),
      androidStoreUrl: expect.stringContaining('play.google.com'),
      updateMessage: expect.any(String),
      mandatoryMessage: expect.any(String),
    });
  });
});
