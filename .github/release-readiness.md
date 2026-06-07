# M6-S3 Release Readiness Runbook

Last updated: 2026-02-24
Owner: Backend + Frontend maintainers

## CI Status Badges

Use these in a repository root README once this project is hosted on GitHub.
Replace `YOUR_GH_ORG_OR_USER/rack-n-roll` with your actual repo path.

- Backend Integration CI

```markdown
[![Backend Integration CI](https://github.com/YOUR_GH_ORG_OR_USER/rack-n-roll/actions/workflows/backend-integration.yml/badge.svg)](https://github.com/YOUR_GH_ORG_OR_USER/rack-n-roll/actions/workflows/backend-integration.yml)
```

- Backend Schema Check CI

```markdown
[![Backend Schema Check CI](https://github.com/YOUR_GH_ORG_OR_USER/rack-n-roll/actions/workflows/backend-schema-check.yml/badge.svg)](https://github.com/YOUR_GH_ORG_OR_USER/rack-n-roll/actions/workflows/backend-schema-check.yml)
```

## Objective
Prepare a repeatable release process with:
- baseline seed data for staging/demo validation,
- explicit environment documentation,
- smoke checks for critical paths,
- rollback notes for fast recovery.

## Environment Documentation

### Backend required variables
- `PORT` (example: `4000`)
- `JWT_SECRET` (high-entropy secret)
- `JWT_EXPIRES_IN` (default `7d`)
- `MONGODB_URI` (Mongo connection string; Atlas example in `backend/.env.example`)
- `SKIP_DB` (`false` in normal backend operation)
- `CORS_ORIGINS` (comma-separated; required in production when shipping Expo web)

Reference: `backend/.env.example`

### Frontend required variables
- `EXPO_PUBLIC_API_BASE_URL` (example: `http://localhost:4000`; production: your deployed API URL)

Reference: `frontend/.env.example`

## Seed Data (Staging/Demo)

Command:

```powershell
cd backend
npm run seed:release
```

What it creates/updates:
- Users:
  - `release.host@racknroll.local`
  - `release.player@racknroll.local`
  - `release.editor@racknroll.local`
- Tournaments:
  - `Release Public Open` (public, open)
  - `Release Invite Open` (inviteOnly, open, invite code `REL2026`)
- Registrations:
  - approved player registration in public tournament
  - underReview player registration in invite-only tournament
- Score editor assignment:
  - release editor assigned to public tournament

## Smoke Checklist (Pre-Deploy and Post-Deploy)

### Happy-path checks
1. Backend health: `GET /health` returns 200 and `status: "ok"`.
2. Auth flow: signup/login works and protected ping returns 200 with token.
3. Discovery feed: authenticated user sees both public and invite-only tournaments.
4. Registration flow:
   - public tournament registration request succeeds,
   - invite-only request succeeds only after valid invite code.
5. Host review:
   - host lists pending,
   - host approves request,
   - status persists as approved.
6. Scoresheet permissions:
   - host or assigned score editor can update scores,
   - non-authorized user is read-only / forbidden for edits.

### Failure/auth checks
1. Duplicate registration request is blocked.
2. Invalid invite code is blocked.
3. Missing token on host-only pending/review endpoints returns 401.
4. Invalid ObjectId route params return standardized `INVALID_ID` errors.

### Commanded regression check

```powershell
cd backend
npm run test:integration
```

Expected result: all integration tests pass.

## Rollback Notes

### Trigger conditions
Rollback if any of the following are true after deploy:
- critical flow fails: discover -> register -> host approve,
- auth failures spike,
- data integrity issue (over-capacity approval, invalid registration state transitions),
- repeated 5xx from tournament routes.

### Rollback plan
1. Stop application process for the new release.
2. Redeploy last known good artifact/image.
3. Point runtime to the previous validated env/config set.
4. Verify `GET /health` and re-run smoke checks for auth + registration.
5. Communicate rollback event and keep new release blocked until root cause is fixed.

### Data considerations
- Avoid destructive data changes during rollback unless explicitly approved.
- Seed script is idempotent for release fixture records and can be re-run after rollback.
- If partial writes occurred during failed release window, inspect `TournamentRegistration` transitions before reopening traffic.

## Release Gate
Release is considered ready when all are true:
- `npm run seed:release` succeeds,
- `npm run test:integration` succeeds,
- GitHub Actions workflow `.github/workflows/backend-integration.yml` is green,
- GitHub Actions workflow `.github/workflows/backend-schema-check.yml` is green,
- smoke checklist passes in staging,
- rollback steps are acknowledged by maintainers.
