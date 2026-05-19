# Backend (M1-S1)

## Run

1. Install dependencies:

```powershell
npm install
```

2. Create environment file:

```powershell
copy .env.example .env
```

3. Start server:

```powershell
npm start
```

## Deploy (Render or Railway)

### Environment (production)

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Yes | Atlas URI including `/rack-n-roll` database name |
| `JWT_SECRET` | Yes | Long random string (not the `.env.example` placeholder) |
| `PORT` | Yes | `4000` (Render sets this automatically if you use their default) |
| `NODE_ENV` | Yes | `production` |
| `CORS_ORIGINS` | If using Expo web | Comma-separated frontend URLs, e.g. `https://your-app.vercel.app` |
| `MAIL_DELIVERY_MODE` | For real email | `smtp` plus SMTP vars (see below) |

See `backend/.env.example` for Atlas URI format and optional variables.

### Render

1. Push the repo to GitHub.
2. In [Render](https://render.com) → **New** → **Blueprint** → connect the repo (uses root `render.yaml`).
3. In the service **Environment** tab, set `MONGODB_URI`, `CORS_ORIGINS`, and SMTP vars (mark secrets as sensitive).
4. In MongoDB Atlas → **Network Access**, allow Render outbound IPs or use `0.0.0.0/0` for initial testing.
5. After deploy: `GET https://<your-service>.onrender.com/health`, then `npm run seed:release` locally pointed at that DB if you want demo data.

### Railway

1. In [Railway](https://railway.app) → **New Project** → deploy from GitHub.
2. Set the service **Root Directory** to `backend` (uses `backend/railway.toml`).
3. Add the same environment variables as in the table above.
4. Allow Railway egress IPs in Atlas **Network Access** (or `0.0.0.0/0` while testing).

### Frontend after API is live

Set `EXPO_PUBLIC_API_BASE_URL` to your deployed API URL (see `frontend/.env.example`), rebuild the app or web export, then run the smoke checklist in `../.github/release-readiness.md`.

## Notes

- Health endpoint: `GET /health`
- Auth endpoints: `POST /api/auth/signup`, `POST /api/auth/login`
- Forgot password endpoints: `POST /api/auth/forgot-password/request`, `POST /api/auth/forgot-password/validate-pin`, `POST /api/auth/forgot-password`
- Protected endpoint: `GET /api/protected/ping`
- Integration tests: `npm run test:integration`
- Optional integration DB override: `TEST_MONGODB_URI` (defaults to `mongodb://127.0.0.1:27017/<generated-test-db>`)
- Password reset email delivery:
  - Use `MAIL_DELIVERY_MODE=smtp` plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`
  - Use `MAIL_DELIVERY_MODE=log` for local development to log the reset PIN to the backend console instead of sending email
  - Optional reset controls: `PASSWORD_RESET_PIN_TTL_MINUTES`, `PASSWORD_RESET_PIN_COOLDOWN_SECONDS`, `PASSWORD_RESET_PIN_MAX_ATTEMPTS`

## SMTP provider setup examples

### Gmail

Use an App Password on the Google account that will send reset emails.

```dotenv
MAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youraccount@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM_EMAIL=youraccount@gmail.com
SMTP_FROM_NAME=Rack-N-Roll
```

### Outlook / Microsoft 365

Use the mailbox password or tenant-approved app credential.

```dotenv
MAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=youraccount@outlook.com
SMTP_PASS=your-password-or-app-password
SMTP_FROM_EMAIL=youraccount@outlook.com
SMTP_FROM_NAME=Rack-N-Roll
```

### SendGrid

Use an API key with SMTP relay credentials.

```dotenv
MAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM_EMAIL=verified-sender@yourdomain.com
SMTP_FROM_NAME=Rack-N-Roll
```

If you only want local testing, keep `MAIL_DELIVERY_MODE=log` and read the PIN from the backend console output.
- Standard error response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Release Readiness (M6-S3)

- Seed baseline release data:

```powershell
npm run seed:release
```

- Validate regression-critical backend flow:

```powershell
npm run test:integration
```

- Detailed runbook, smoke checklist, and rollback notes: `../.github/release-readiness.md`
