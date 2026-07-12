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
- **EAS build directory:** always run EAS from `frontend/` (not the repo root). Verify versions before building: `npm run release:info` (should show `1.3.3` / `versionCode 16` or higher after bump).
- **EAS build command:** `npm run eas:build:production -- --platform android` syncs version, bumps `versionCode`, prints release info, then starts the build. Plain `eas build` uses `app.config.js`, which reads `version` from `package.json`.
- **Google Sign-In on EAS/Play:** set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (and optional iOS/Android IDs) in [Expo → Project → Environment variables](https://expo.dev) for the `production` environment, or add them under `build.production.env` in `eas.json`. Must match backend `GOOGLE_CLIENT_ID` (Web application OAuth client).
- **Play Store installs:** Google re-signs the app. Register the **App signing key certificate SHA-1** from Play Console → Setup → App integrity → App signing, in addition to the Expo upload keystore SHA-1. Upload-key SHA-1 alone is not enough for Play-distributed builds.
- Release smoke and rollback guidance: `../.github/release-readiness.md`.

## Web (browser / iOS users without the App Store)

The same Expo app runs in the browser via `react-native-web`. Use this for iPhone users until an iOS build is published.

### Local dev

```powershell
copy .env.example .env
# Set EXPO_PUBLIC_API_BASE_URL=https://rack-n-roll.onrender.com for production API
# Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for Google Sign-In
npm run web
```

### Production build

```powershell
$env:EXPO_PUBLIC_API_BASE_URL="https://rack-n-roll.onrender.com"
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="your-web-client-id.apps.googleusercontent.com"
npm run build:web
```

Output: `dist/` (gitignored). Preview locally with `npm run preview:web`.

### Deploy (Vercel or Netlify)

1. Connect the repo and set **Root directory** to `frontend`.
2. Add environment variables in the host dashboard:
   - `EXPO_PUBLIC_API_BASE_URL` = `https://rack-n-roll.onrender.com`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = same Web OAuth client as backend `GOOGLE_CLIENT_ID`
3. Build command / output are configured in `vercel.json` and `netlify.toml`.
4. On Render (backend), add your web URL to `CORS_ORIGINS`, e.g. `https://your-app.vercel.app`.
5. In Google Cloud Console → Web OAuth client, add **Authorized JavaScript origins** and **redirect URIs** for your production domain (and `http://localhost:8081` for local dev).

Production web builds fall back to `https://rack-n-roll.onrender.com` if `EXPO_PUBLIC_API_BASE_URL` is missing at build time (`src/config/apiBaseUrl.js`).
