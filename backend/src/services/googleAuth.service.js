const { OAuth2Client } = require('google-auth-library');
const ApiError = require('../utils/ApiError');

let verifyGoogleIdTokenOverride = null;

const resolveGoogleClientId = () => String(process.env.GOOGLE_CLIENT_ID || '').trim();

const verifyGoogleIdToken = async (idToken) => {
  if (verifyGoogleIdTokenOverride) {
    return verifyGoogleIdTokenOverride(idToken);
  }

  const clientId = resolveGoogleClientId();

  if (!clientId) {
    throw new ApiError(503, 'GOOGLE_AUTH_NOT_CONFIGURED', 'Google sign-in is not configured on the server');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  return ticket.getPayload();
};

const __setVerifyGoogleIdTokenOverride = (overrideFn) => {
  verifyGoogleIdTokenOverride = typeof overrideFn === 'function' ? overrideFn : null;
};

module.exports = {
  verifyGoogleIdToken,
  __setVerifyGoogleIdTokenOverride,
};
