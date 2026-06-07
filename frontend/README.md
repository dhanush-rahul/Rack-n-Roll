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
- Release smoke and rollback guidance: `../.github/release-readiness.md`.
