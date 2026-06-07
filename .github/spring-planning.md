Sprint Board (AI-Executable)

Execution Progress (updated 2026-02-24)
- Completed: M2-S2 Tournament geo + registration schema finalization.
- Completed: M3-S1 Discovery feed (backend endpoint + frontend feed wiring, no location picker/filter).
- Completed: M3-S2 Invite code validation (backend endpoint + frontend invite-only gate state).
- Completed: M3-S3 Registration request submit (underReview creation + duplicate/open guards).
- Milestone 3 status: Complete.
- Completed: M4-S1 Pending request review (host-only pending list + approve/reject review transitions).
- Completed: M4-S2 Capacity enforcement (atomic approval slot reservation + over-capacity blocking).
- Completed: M4-S3 Manual add/remove participants (host-only manual override endpoints with integrity guards).
- Milestone 4 status: Complete.
- Completed: M5-S1 Score editor permissions (host-only assign/remove endpoints + score edit permission helper).
- Completed: M5-S2 Scoresheet UI (scoresheet screen + read-only mode + score update API integration).
- Completed: M5-S3 Leaderboard recompute (deterministic recompute from Game records, auto-triggered on score writes).
- Milestone 5 status: Complete.
- Completed: M6-S1 Validation/security hardening (route-level payload/param checks + safer error sanitization).
- Completed: M6-S2 Integration test pack (critical flow + failure/auth paths verified with backend integration tests).
- Completed: M6-S3 Release readiness (seed script + environment docs + smoke checklist + rollback runbook).
- Completed: CI regression gate (GitHub Actions backend integration workflow on PR/push).
- Completed: CI schema gate (GitHub Actions backend schema check workflow on PR/push).
- Milestone 6 status: Complete.

Cadence: 2-week sprints, vertical slices, merge only when acceptance criteria pass.
Branching: one story per branch; no mixed-domain changes.
Quality gate: each story must include API contract notes + test evidence + permission checks.
Milestone 1 — Platform Foundation + Auth

Story M1-S1: Backend skeleton
Subtasks: initialize Express app layers, middleware chain (auth/validation/error), health route, env loader.
Acceptance: app boots; health route returns 200; standardized error response shape.
Story M1-S2: Frontend shell + API client
Subtasks: Expo navigation shell, centralized API client, token injection, global error parsing.
Acceptance: API calls only through client; unauthorized calls surface consistent UI state.
Story M1-S3: Signup/login/session restore
Subtasks: user model, password hashing, JWT issue/verify, login/signup screens, token persistence.
Acceptance: signup/login works; relaunch restores session; protected endpoint blocks invalid token.
Milestone 2 — Core Models + Tournament Creation

Story M2-S1: Core schemas
Subtasks: Tournament/Division/Game/Player/Leaderboard/TournamentRegistration models + enums + refs.
Acceptance: invalid enums rejected; valid linked seed data inserts.
Story M2-S2: Tournament geo + registration schema finalization
Subtasks: add hostUserId, maxParticipants, registrationMode, inviteCode, registrationStatus, geo fields, 2dsphere index.
Acceptance: geo payload validates [lng, lat]; index exists; missing required fields fail validation.
Story M2-S3: Host create tournament flow
Subtasks: create endpoint, host ownership checks, frontend create form with location capture + registration mode.
Acceptance: host can create public and inviteOnly; non-host cannot mutate host-owned tournament.
Milestone 3 — Discovery + Registration Entry

Story M3-S1: Discovery feed ✅ (Completed 2026-02-23)
Subtasks: discovery service query, pagination/sort, discover screen list rendering.
Acceptance: public and inviteOnly both visible; no location picker/filter in UX.
Story M3-S2: Invite code validation ✅ (Completed 2026-02-23)
Subtasks: validate-code endpoint, frontend gate state for invite-only join.
Acceptance: invalid code never enables submit; valid code enables request action.
Story M3-S3: Registration request submit ✅ (Completed 2026-02-23)
Subtasks: submit endpoint, duplicate prevention, initial status underReview, registration open/closed guard.
Acceptance: duplicates blocked; closed registration blocked; public submit works without code.
Milestone 4 — Host Review + Participant Overrides

Story M4-S1: Pending request review ✅ (Completed 2026-02-23)
Subtasks: host-only list pending, approve/reject endpoints, audit-friendly status transitions.
Acceptance: non-host forbidden; pending -> approved/rejected transitions persist correctly.
Story M4-S2: Capacity enforcement ✅ (Completed 2026-02-23)
Subtasks: approval/add flows enforce maxParticipants; approved-count query is race-safe.
Acceptance: over-capacity approval fails deterministically; no overfill under concurrent approvals.
Story M4-S3: Manual add/remove participants ✅ (Completed 2026-02-23)
Subtasks: host-only add/remove endpoints + UI actions with integrity guards.
Acceptance: duplicates blocked; invalid removals handled; state remains consistent after overrides.
Milestone 5 — Scoresheet + Leaderboard

Story M5-S1: Score editor permissions ✅ (Completed 2026-02-23)
Subtasks: enforce host + max 2 scoreEditorUserIds; host-only editor assignment/removal.
Acceptance: unauthorized score edits rejected; authorized edits allowed.
Story M5-S2: Scoresheet UI ✅ (Completed 2026-02-23)
Subtasks: fast score entry screen, read-only mode for unauthorized viewers, API integration through client.
Acceptance: authorized users edit/update; others can only view.
Story M5-S3: Leaderboard recompute ✅ (Completed 2026-02-23)
Subtasks: recompute service from Game records, trigger on score writes, scoped by tournament/division.
Acceptance: leaderboard updates after score change; recompute idempotent and deterministic.
Milestone 6 — Hardening + Release

Story M6-S1: Validation/security hardening ✅ (Completed 2026-02-23)
Subtasks: request schema validation, permission middleware coverage, error sanitization.
Acceptance: malformed payloads rejected cleanly; permission tests pass.
Story M6-S2: Integration test pack ✅ (Completed 2026-02-23)
Subtasks: E2E critical flows (discover -> register -> host approve -> participant visible), failure-path tests.
Acceptance: all critical paths green; regressions blocked in CI.
Story M6-S3: Release readiness ✅ (Completed 2026-02-24)
Subtasks: seed data, environment docs, smoke checklist, rollback notes.
Acceptance: staging smoke pass; deployment/runbook complete.
Per-Story AI Task Card (use this exact format)

Objective: one measurable outcome.
Scope: backend layers touched, frontend screens touched, API methods touched.
Rules: permission checks + domain invariants + forbidden shortcuts.
Implementation checklist: 5–10 concrete tasks.
Acceptance tests: 1 happy path + 2 failure paths + 1 auth/permission path.
Deliverables: code diff summary, contract changes, test output.
Suggested Sprint Order

Sprint 1: Milestone 1
Sprint 2: Milestone 2
Sprint 3: Milestone 3
Sprint 4: Milestone 4
Sprint 5: Milestone 5
Sprint 6: Milestone 6

---

Sprint 1 Execution Pack (copy-paste for AI)

Sprint Goal
- Establish production-ready foundation for backend and frontend.
- Complete authentication end-to-end with token persistence.
- Enforce architecture constraints from project instructions.

Sprint Scope Lock
- In scope: M1-S1, M1-S2, M1-S3 only.
- Out of scope: tournament creation, discovery, registration workflow, scoring.

Global Constraints For Every Sprint 1 Story
- Backend layering must remain: Routes -> Controllers -> Services -> Models -> MongoDB.
- Frontend API access must remain: Screens -> src/services/api.js -> Backend REST API.
- Controllers handle HTTP concerns only; business logic stays in services.
- No direct axios/fetch calls from screens/components.
- Keep changes small and incremental; avoid introducing Redux/Context.

Story M1-S1: Backend skeleton

Ready Criteria
- Backend folder exists and npm dependencies are installable.
- Environment variables documented in .env.example.

AI Prompt (copy-paste)
You are implementing Story M1-S1 in a Node.js + Express + MongoDB codebase.

Objective:
Create a backend skeleton that enforces layered architecture and provides a stable API foundation.

Requirements:
1) Implement project structure aligned to Routes -> Controllers -> Services -> Models.
2) Add middleware chain in this order:
	- request logger (lightweight)
	- authentication middleware (no-op pass-through allowed for now if auth not yet wired)
	- validation middleware scaffold
	- centralized error handler (final middleware)
3) Add GET /health endpoint returning:
	- status: "ok"
	- service: "rack-n-roll-api"
	- timestamp (ISO string)
4) Standardize API error shape:
	- success: false
	- error: { code, message, details? }
5) Add startup config loader with fail-fast behavior for missing critical env values.
6) Keep controllers thin and move reusable logic into services.

Deliverables:
- New/updated backend files for app bootstrap, route registration, middleware, and health route.
- Brief README section for backend run steps.

Acceptance tests to run:
- Happy path: GET /health returns HTTP 200 and expected JSON shape.
- Failure path 1: unknown route returns standardized 404 error shape.
- Failure path 2: thrown controller error is converted by centralized error handler.
- Permission path: auth middleware scaffold runs on protected route and returns 401 when token missing (even with temporary token logic).

Definition of Done
- Backend starts with one command.
- /health responds correctly.
- Error responses are consistent for 404 and thrown exceptions.
- Middleware chain executes in expected order.

Story M1-S2: Frontend shell + API client

Ready Criteria
- Expo app boots.
- Base navigation dependency is installed.

AI Prompt (copy-paste)
You are implementing Story M1-S2 in a React Native + Expo app.

Objective:
Create frontend application shell and centralized API client integration.

Requirements:
1) Build app shell with navigation container and placeholder authenticated/unauthenticated stacks.
2) Create/standardize src/services/api.js as the only API gateway.
3) Implement request interceptor behavior:
	- attach bearer token when available
4) Implement response normalization:
	- map backend error shape to a consistent frontend error object
5) Add a minimal token store utility used only by api.js and auth flow.
6) Ensure no screen directly calls axios/fetch.

Deliverables:
- Navigation shell files and src/services/api.js wiring.
- One example screen calling API client through a service method.

Acceptance tests to run:
- Happy path: API call via api.js succeeds and data reaches screen state.
- Failure path 1: 401 response is normalized and visible in UI state.
- Failure path 2: network error is normalized and non-crashing.
- Permission path: when token is missing, protected API call path is handled predictably in UI.

Definition of Done
- App launches and renders navigation shell.
- API calls are centralized via src/services/api.js.
- Error handling is consistent across at least two screens/states.

Story M1-S3: Signup/login/session restore

Ready Criteria
- M1-S1 and M1-S2 merged.

AI Prompt (copy-paste)
You are implementing Story M1-S3 for full authentication basics.

Objective:
Implement signup/login and persistent session restore across app relaunch.

Requirements:
Backend:
1) Add User model fields needed for auth (minimal, secure).
2) Add signup and login routes/controllers/services.
3) Hash passwords before storage and verify on login.
4) Issue JWT with expiry and validate token middleware.

Frontend:
5) Build signup and login screens.
6) Persist token securely and restore session on app startup.
7) Implement logout flow clearing token and auth state.
8) Gate navigation by auth state.

Constraints:
- Keep controllers HTTP-only; move auth rules to services.
- Use src/services/api.js for all auth API calls.

Deliverables:
- Auth endpoints + middleware.
- Frontend auth screens + token persistence + session bootstrap.

Acceptance tests to run:
- Happy path: user signs up, logs in, reaches authenticated stack.
- Failure path 1: invalid credentials returns controlled error and UI message.
- Failure path 2: expired/invalid token blocks protected endpoint.
- Permission path: protected backend route returns 401 for missing token, 200 for valid token.

Definition of Done
- Signup/login works end-to-end.
- Relaunch restores authenticated session when token valid.
- Invalid/expired token forces unauthenticated state.

Sprint 1 QA Checklist
- Architecture layering is preserved in every changed backend endpoint.
- No direct HTTP calls from screens (grep verification).
- Error payload structure is consistent.
- Auth middleware is applied to at least one protected route.
- Basic manual smoke pass recorded in PR description.

Sprint 1 Exit Criteria
- All three stories merged.
- Acceptance checks passed and recorded.
- No blocker defects in auth happy path.

Sprint 1 Suggested Branch Plan
- feature/m1-s1-backend-skeleton
- feature/m1-s2-frontend-shell-api-client
- feature/m1-s3-auth-basics

Sprint 1 Handoff Format (for each PR)
- What changed (files + architecture layer mapping)
- API contracts added/updated
- Test evidence (commands + result summary)
- Known limitations and follow-up tasks

---

Sprint 2 Execution Pack (copy-paste for AI)

Sprint Goal
- Deliver complete tournament core model foundation and host create flow baseline.
- Lock domain model contracts for discovery/registration work in Sprint 3.
- Preserve strict backend layering and frontend API gateway rules.

Sprint Scope Lock
- In scope: M2-S1, M2-S2, M2-S3 only.
- Out of scope: discovery feed UI behavior, registration submit/review, scoring workflows.

Global Constraints For Every Sprint 2 Story
- Backend flow must remain: Routes -> Controllers -> Services -> Models -> MongoDB.
- Frontend flow must remain: Screens -> src/services/api.js -> Backend REST API.
- Keep controllers HTTP-only; business rules in services.
- Do not reintroduce location ownership/admin model.
- Keep tournament location map-based (`Point` + `[lng, lat]`) and host-owned.

Story M2-S1: Core schemas

Ready Criteria
- Sprint 1 merged and auth baseline available.
- Backend model folder exists and Mongoose is configured.

AI Prompt (copy-paste)
You are implementing Story M2-S1 in a Node.js + Express + MongoDB codebase.

Objective:
Add baseline domain models with enums/refs/indexes for Tournament, Division, Game, Player, Leaderboard, and TournamentRegistration.

Requirements:
1) Add Mongoose schema files for all six domain models.
2) Include enum constraints for statuses and lifecycle states.
3) Include relationship refs consistent with domain rules:
	- Tournament has many Divisions.
	- Division has many Players (or refs).
	- Games belong to Tournament and optional Division.
	- Leaderboard is scoped by tournament/division and derived from Game.
	- TournamentRegistration links user to tournament with request status.
4) Add indexes for common lookup/query paths and uniqueness where required.
5) Keep model definitions baseline-safe; final geo/registration required fields are completed in M2-S2.

Deliverables:
- Six model files under src/models.
- One lightweight schema validation script demonstrating enum rejection + valid linked document acceptance.

Acceptance tests to run:
- Happy path: valid linked domain documents pass schema validation.
- Failure path 1: invalid enum on Tournament fails validation.
- Failure path 2: invalid enum on TournamentRegistration fails validation.
- Permission path: not applicable for model-only story; verify no route/controller changes violate layering.

Definition of Done
- Models compile and validate.
- Schema check script passes.
- No diagnostics errors in backend files.

Story M2-S2: Tournament geo + registration schema finalization

Ready Criteria
- M2-S1 merged.

AI Prompt (copy-paste)
You are implementing Story M2-S2 to finalize tournament schema requirements.

Objective:
Upgrade Tournament schema to match required location and registration model contracts.

Requirements:
1) Add/ensure required fields on Tournament:
	- hostUserId
	- maxParticipants
	- registrationMode (`public` | `inviteOnly`)
	- inviteCode
	- registrationStatus (`open` | `closed`)
	- location.type = `Point`
	- location.coordinates = `[lng, lat]`
	- location.countryCode
	- location.provinceCode
	- location.city
	- location.formattedAddress
2) Add `2dsphere` index on location for geo discovery.
3) Add schema-level guards:
	- coordinates length must be 2
	- coordinate values must be numeric and valid ranges
	- inviteCode required only when registrationMode is `inviteOnly`
4) Keep score editor max-2 validation intact.

Deliverables:
- Updated Tournament schema with required fields, validators, and indexes.
- Validation checks covering valid/invalid location + registration combinations.

Acceptance tests to run:
- Happy path: valid tournament payload with geo + registration fields passes validation.
- Failure path 1: invalid coordinate array/order/range fails validation.
- Failure path 2: inviteOnly without inviteCode fails validation.
- Permission path: not route-level; confirm host ownership field is required by schema.

Definition of Done
- Required schema fields and indexes are present.
- Validation rules enforce geo and registration contracts.
- Existing model checks remain green.

Story M2-S3: Host create tournament flow

Ready Criteria
- M2-S2 merged.
- Frontend API gateway and auth token flow available from Sprint 1.

AI Prompt (copy-paste)
You are implementing Story M2-S3 for host tournament creation.

Objective:
Allow authenticated hosts to create tournaments with capacity, registration mode, and map-based location payload.

Requirements:
Backend:
1) Add route `POST /api/tournaments`.
2) Add controller with HTTP-only concerns and service delegation.
3) Service enforces:
	- authenticated user becomes `hostUserId`
	- payload validation using Tournament schema
	- invite code handling by registration mode
4) Return normalized success payload with created tournament.

Frontend:
5) Add create tournament screen with fields:
	- name, maxParticipants, registrationMode, inviteCode (conditional), location metadata inputs
6) Add API service methods in src/services/api.js helper usage layer (no direct axios in screens).
7) Wire navigation entry from authenticated stack to create tournament screen.

Deliverables:
- Backend route/controller/service for create tournament.
- Frontend create screen + service integration.

Acceptance tests to run:
- Happy path: authenticated host creates `public` tournament successfully.
- Failure path 1: unauthenticated request returns 401.
- Failure path 2: inviteOnly without inviteCode is rejected.
- Permission path: `hostUserId` is always server-set from auth context, not client-settable.

Definition of Done
- Create flow works end-to-end.
- API contract documented in PR notes.
- Frontend calls only through service/api gateway.

Sprint 2 QA Checklist
- All six core models exist and align with domain relationships.
- Tournament schema includes required geo and registration fields + `2dsphere` index.
- Model validation catches enum and geo contract failures.
- Create tournament endpoint enforces authenticated host ownership.
- No direct HTTP calls from frontend screens.

Sprint 2 Exit Criteria
- M2-S1, M2-S2, and M2-S3 merged.
- Acceptance checks passed and recorded.
- Tournament creation data contract is stable for Sprint 3 discovery/registration work.

Sprint 2 Suggested Branch Plan
- feature/m2-s1-core-schemas
- feature/m2-s2-tournament-schema-finalization
- feature/m2-s3-host-create-tournament

Sprint 2 Handoff Format (for each PR)
- What changed (files + architecture layer mapping)
- API contracts added/updated
- Test evidence (commands + result summary)
- Known limitations and follow-up tasks

---

Sprint 7 Execution Pack (copy-paste for AI)

Sprint Goal
- Deliver a host-only Tournament Detail screen with segmented tabs: Registration and Playing Pattern.
- Enable host review workflow with pending-first ordering and manual participant add by user search.
- Generate round-robin matchups from approved participants only.

Sprint Window
- Start: 2026-02-25
- End: TBD
- Owner/DRI: me

Sprint Scope Lock
- In scope: host-only tournament detail access, segmented tabs, approved+pending registration list (pending first), user search + manual add, round-robin generation from approved participants.
- Out of scope: bracket formats other than round-robin, non-host participant management actions, scoring UX redesign.
- Story points: not assigned yet.

Global Constraints For Every Sprint 7 Story
- Backend flow remains: Routes -> Controllers -> Services -> Models -> MongoDB.
- Frontend flow remains: Screens -> src/services/api.js -> Backend REST API.
- Controllers stay HTTP-only; business rules stay in services.
- Manual add, approve/reject, and remove remain host-only actions.
- Round-robin source set must be approved participants only.

Story M7-S1: Host-only Tournament Detail + Segmented Tabs
Subtasks: add host-only tournament detail entry point; enforce host permission at API and UI; implement segmented tabs (Registration, Playing Pattern); keep non-host users blocked from host actions.
Acceptance: host sees both tabs and management actions; non-host cannot access host management actions; tab switching is stable and preserves state.

Story M7-S2: Registration Tab — Pending-First List + Manual Add Search
Subtasks: fetch and render pending + approved registrations in one view; sort with pending first; add user search input for host manual add; wire add action with duplicate/capacity/open-status guards; refresh list after mutations.
Acceptance: pending registrations always render before approved; host can find users via search and submit manual add; duplicate or over-capacity adds are blocked with clear errors.

Story M7-S3: Playing Pattern Tab — Round-Robin From Approved Participants
Subtasks: add round-robin generation on Playing Pattern tab; service builds schedule only from approved participants; prevent generation when approved set is insufficient.
Acceptance: generated schedule includes only approved participants; unapproved/pending users never appear in pairings; regeneration behavior is deterministic and guarded against invalid states.

Sprint 7 QA Checklist
- Host-only permissions enforced for detail actions and participant overrides.
- Registration list ordering verified: pending before approved.
- Manual add search returns users and respects duplicate/capacity/registration-state rules.
- Round-robin generation includes approved participants only.
- Frontend API calls route exclusively through src/services/api.js.

Sprint 7 Exit Criteria
- All Sprint 7 stories merged.
- Acceptance checks passed and recorded.
- No blocker defects in host registration management or round-robin generation.

Sprint 7 Suggested Branch Plan
- feature/m7-s1-host-tournament-detail-tabs
- feature/m7-s2-registration-pending-first-manual-add-search
- feature/m7-s3-playing-pattern-round-robin-approved-only

Sprint 7 Handoff Format (for each PR)
- What changed (files + architecture layer mapping)
- API contracts added/updated
- Test evidence (commands + result summary)
- Known limitations and follow-up tasks
