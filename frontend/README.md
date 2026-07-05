# Frontend (M1-S2)

## Run

1. Install dependencies:

```powershell
npm install
```

2. Create env file:

```powershell
copy .env.example .env
```

3. Start Expo:

```powershell
npx expo start
```

## Notes

- Navigation is gated by auth context in `src/context/AuthContext.js`.
- All HTTP requests are centralized in `src/services/api.js`.
- Example API usage is in `src/services/systemService.js` and `src/screens/HomeScreen.js`.
- Required env var: `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`).
- **EAS builds:** local `.env` is gitignored and is **not** uploaded to EAS. Production URL is set in `eas.json` under `build.production.env` (and `preview`).
- **EAS build directory:** always run EAS from `frontend/` (not the repo root). Verify versions before building: `npm run release:info` (should show `1.3.2` / `versionCode 12` or higher after bump).
- **EAS build command:** `npm run eas:build:production -- --platform android` syncs version, bumps `versionCode`, prints release info, then starts the build. Plain `eas build` uses `app.config.js`, which reads `version` from `package.json`.
- **Google Sign-In on EAS/Play:** set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (and optional iOS/Android IDs) in [Expo → Project → Environment variables](https://expo.dev) for the `production` environment, or add them under `build.production.env` in `eas.json`. Must match backend `GOOGLE_CLIENT_ID` (Web application OAuth client).
- **Play Store installs:** Google re-signs the app. Register the **App signing key certificate SHA-1** from Play Console → Setup → App integrity → App signing, in addition to the Expo upload keystore SHA-1. Upload-key SHA-1 alone is not enough for Play-distributed builds.
- Release smoke and rollback guidance: `../.github/release-readiness.md`.
