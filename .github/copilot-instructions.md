# Copilot Instructions - Rack-N-Roll

## What this app is
Rack-N-Roll is a community-hosted tournament platform. Any signed-in user can host a tournament, set tournament settings, and other users can discover tournaments and submit participation requests.

## Who it serves
- Hosts: create and run tournaments.
- Players/attendees: discover tournaments, request registration, and join after host approval.

## Stack (locked)
- Frontend: React Native + Expo
- Backend: Node.js + Express + MongoDB (Mongoose)
- Keep this stack unless explicitly requested otherwise.

## Architecture rules (must follow)
- Backend flow: Routes -> Controllers -> Services -> Models -> MongoDB
- Frontend flow: Screens -> src/services/api.js -> Backend REST API
- Controllers handle HTTP concerns only.
- Services contain business logic.
- All API calls go through src/services/api.js (no direct axios calls from screens).

## Domain direction (important)
- Remove physical-location ownership/admin model.
- Use user-hosted tournaments with geo metadata.
- Tournament stores location as map-based data (lat/lng + display fields), not locationId ownership.
- Use participant self-registration as the default model.
- Visibility rule: users can discover both public and inviteOnly tournaments in the app.
- Invite-only rule: if a tournament is inviteOnly, user must enter a valid inviteCode to enable registration.
- Host approval rule: for both public and inviteOnly tournaments, registration is request-based and host-reviewed.
- Host controls participation policy and capacity, and can manually add/remove/approve/reject participants when needed.

## Tournament location model
- Required fields on Tournament:
	- hostUserId
	- maxParticipants
	- registrationMode (public | inviteOnly)
	- inviteCode
	- registrationStatus (open | closed)
	- location.type = "Point"
	- location.coordinates = [lng, lat]
	- location.countryCode
	- location.provinceCode
	- location.city
	- location.formattedAddress
- Add a 2dsphere index for geo discovery.

## Tournament registration model
- Self-registration is required:
	- All tournaments are discoverable in the app.
	- Invite-only tournaments require a valid inviteCode before the register action is enabled.
	- Public tournaments do not require inviteCode to submit registration.
	- No user-facing location picker/filter is used to choose tournaments.
	- Registration request status starts as underReview and requires host approval.
	- Suggested registration statuses: underReview | approved | rejected | removed.
- Capacity behavior:
	- Host sets maxParticipants.
	- Registration requests are accepted only when registrationStatus is open.
	- Approvals must enforce maxParticipants capacity.
	- Prevent duplicate registrations by the same user.
- Host override behavior:
	- Host can manually add participants.
	- Host can manually remove participants.
	- Host can approve or reject pending registration requests.
	- Host manual changes must still respect tournament state and data integrity.

## Core domain models (still required)
- Tournament: host-owned event with metadata, location, divisions, and status.
- Division: subgroup inside a tournament used for matchup generation.
- Game: single matchup record between two players with per-game score entries.
- Player: user profile data used in tournaments (including handicap fields if enabled).
- Leaderboard: computed ranking view per tournament/division from game outcomes.
- TournamentRegistration (or Participant link model): user-to-tournament enrollment record with request status (underReview/approved/rejected/removed).

## Tournament permissions (required)
- Tournament supports delegated score editors: up to 2 additional users.
- Suggested field: scoreEditorUserIds (array of userIds, max length 2).
- Only host can assign/remove score editors.
- Score editors are scoped per tournament (not global app admins).
- Only host can manually add/remove participants.
- Only host can approve/reject registration requests.
- Standard users can submit registration requests only under registration rules (mode/code and open status).

## Model relationship rules
- One Tournament has many Divisions.
- One Division has many Players (or player references).
- Games belong to a Tournament and usually a Division.
- Leaderboard entries are derived from Games; treat leaderboard as computed data, not the source of truth.
- Keep geo fields on Tournament (not on a location-ownership model).
- One Tournament has many TournamentRegistration (or participant link) records.
- One User can have many TournamentRegistration records.

## Scoresheet flow (required)
- Provide a Scoresheet screen for hosts to enter game scores per matchup.
- Scores are recorded on Game entries (per-game score data), then leaderboard is recomputed.
- Keep score-entry UI simple and fast for live tournament operations.
- All score submission calls must go through src/services/api.js.
- Only the tournament host or assigned score editors can submit/update scores.
- Non-authorized users can view scoresheet data but must have read-only UI.

## Discovery behavior
- Both public and inviteOnly tournaments can appear in discovery results.
- Invite-only tournaments must show locked registration until a valid inviteCode is entered.
- Users do not pick tournaments using location filters.
- Tournament join entry points:
	- Discover tournaments and open tournament detail.
	- For inviteOnly: enter inviteCode, then enable register request.
	- For public: register request is available directly.
	- For both modes: request becomes underReview until host approves/rejects.

## Small step-by-step build goals
1. Auth basics: user signup/login and token persistence.
2. Core schemas: Tournament, Division, Game, Player, Leaderboard baseline models.
3. Tournament schema update: add registration fields, geo fields, and 2dsphere index.
4. Create tournament flow: host sets capacity and registration mode, then uses current location or map pick.
5. Discovery API: return both public and inviteOnly tournaments for feed.
6. Registration API: submit registration request from tournament detail.
7. Invite-only code validation API: validate inviteCode and enable request action.
8. Host review API: approve/reject pending registration requests.
9. Participant management: host manual add/remove participants.
10. Discover screen: all tournaments feed (no location picker/filter).
11. Tournament detail: show map location, host info, and registration request state.
12. Scoresheet screen: enter/update matchup scores for games.
13. Score entry + leaderboard updates for hosted tournaments.

## Development workflow
Backend:
```powershell
cd backend
npm install
node index.js
```

Frontend:
```powershell
cd frontend
npm install
npx expo start
```

## Implementation guardrails for agents
- Keep changes small and ship in quick milestones.
- Reuse existing patterns before introducing new abstractions.
- Do not add Redux/Context unless asked.
- Do not reintroduce location ownership/admin flows.
