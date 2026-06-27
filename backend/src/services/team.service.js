const Team = require('../models/team.model');
const Player = require('../models/player.model');
const Tournament = require('../models/tournament.model');
const ApiError = require('../utils/ApiError');

const isDoublesTournament = (tournament) =>
  String(tournament?.competitionConfig?.format || 'singles') === 'doubles';

const getFirstName = (displayName) => {
  const trimmed = String(displayName || '').trim();
  if (!trimmed) {
    return 'Player';
  }
  return trimmed.split(/\s+/)[0];
};

const buildDefaultTeamDisplayName = (playerOne, playerTwo) =>
  `${getFirstName(playerOne?.displayName)} & ${getFirstName(playerTwo?.displayName)}`;

const mapTeamSummary = (team, playerSummaryById = new Map()) => {
  const player1 = playerSummaryById.get(String(team.player1Id)) || null;
  const player2 = playerSummaryById.get(String(team.player2Id)) || null;

  return {
    id: String(team._id),
    tournamentId: String(team.tournamentId),
    divisionId: team.divisionId ? String(team.divisionId) : null,
    player1Id: String(team.player1Id),
    player2Id: String(team.player2Id),
    player1,
    player2,
    displayName: team.displayName,
    customDisplayName: team.customDisplayName || null,
    status: team.status,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
};

const buildPlayerSummaryById = async (playerIds = []) => {
  const normalized = [...new Set(playerIds.map((value) => String(value)).filter(Boolean))];
  if (normalized.length === 0) {
    return new Map();
  }

  const players = await Player.find({ _id: { $in: normalized } })
    .select({ _id: 1, userId: 1, displayName: 1, teamId: 1, awaitingPartner: 1, handicapEnabled: 1, handicapValue: 1 })
    .lean();

  return players.reduce((acc, player) => {
    acc.set(String(player._id), {
      id: String(player._id),
      userId: player.userId ? String(player.userId) : null,
      displayName: player.displayName,
      teamId: player.teamId ? String(player.teamId) : null,
      awaitingPartner: Boolean(player.awaitingPartner),
      handicapEnabled: Boolean(player.handicapEnabled),
      handicapValue: Number(player.handicapValue || 0),
    });
    return acc;
  }, new Map());
};

const getActivePlayerForUser = async (tournamentId, userId) => {
  const player = await Player.findOne({
    tournamentId,
    userId,
    status: 'active',
  }).lean();

  if (!player) {
    throw new ApiError(404, 'PLAYER_NOT_FOUND', 'You are not an active player in this tournament');
  }

  return player;
};

const assertHostOrTeamMember = async (tournamentId, userId, team) => {
  const tournament = await Tournament.findById(tournamentId).select({ hostUserId: 1 }).lean();
  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (String(tournament.hostUserId) === String(userId)) {
    return { isHost: true };
  }

  const actor = await Player.findOne({ tournamentId, userId, status: 'active' }).select({ _id: 1 }).lean();
  if (!actor) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to manage this team');
  }

  const actorId = String(actor._id);
  if (actorId !== String(team.player1Id) && actorId !== String(team.player2Id)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only team members or the host can update this team');
  }

  return { isHost: false, actorPlayerId: actorId };
};

const materializeRosterPlayers = async (tournamentId) => {
  const { materializeApprovedPlayers } = require('./tournament');
  return materializeApprovedPlayers(tournamentId);
};

const listTournamentTeams = async (tournamentId) => {
  await materializeRosterPlayers(tournamentId);

  const teams = await Team.find({ tournamentId, status: 'active' }).sort({ createdAt: 1, _id: 1 }).lean();
  const playerIds = teams.flatMap((team) => [team.player1Id, team.player2Id]);
  const playerSummaryById = await buildPlayerSummaryById(playerIds);

  return teams.map((team) => mapTeamSummary(team, playerSummaryById));
};

const listSoloPlayers = async (tournamentId) => {
  await materializeRosterPlayers(tournamentId);

  const solos = await Player.find({
    tournamentId,
    status: 'active',
    teamId: null,
  })
    .sort({ displayName: 1, _id: 1 })
    .lean();

  const soloByUserId = new Map();

  solos.forEach((player) => {
    const userKey = String(player.userId || '').trim();

    if (!userKey || soloByUserId.has(userKey)) {
      return;
    }

    soloByUserId.set(userKey, player);
  });

  return [...soloByUserId.values()].map((player) => ({
    id: String(player._id),
    userId: player.userId ? String(player.userId) : null,
    displayName: player.displayName,
    awaitingPartner: Boolean(player.awaitingPartner),
  }));
};

const createTeamFromPlayers = async (tournamentId, player1Id, player2Id, { customDisplayName = null } = {}) => {
  if (String(player1Id) === String(player2Id)) {
    throw new ApiError(400, 'INVALID_TEAM', 'A team requires two different players');
  }

  const players = await Player.find({
    tournamentId,
    _id: { $in: [player1Id, player2Id] },
    status: 'active',
  }).lean();

  if (players.length !== 2) {
    throw new ApiError(409, 'PLAYERS_NOT_AVAILABLE', 'Both players must be active tournament participants');
  }

  const playerById = new Map(players.map((player) => [String(player._id), player]));

  for (const player of players) {
    if (player.teamId) {
      throw new ApiError(409, 'PLAYER_ALREADY_TEAMED', 'One or both players are already on a team');
    }
  }

  const p1 = playerById.get(String(player1Id));
  const p2 = playerById.get(String(player2Id));
  const defaultName = buildDefaultTeamDisplayName(p1, p2);
  const trimmedCustom = String(customDisplayName || '').trim();
  const displayName = trimmedCustom || defaultName;

  const team = await Team.create({
    tournamentId,
    player1Id,
    player2Id,
    displayName,
    customDisplayName: trimmedCustom || null,
    status: 'active',
  });

  await Player.updateMany(
    { _id: { $in: [player1Id, player2Id] } },
    { $set: { teamId: team._id, awaitingPartner: false } }
  );

  const playerSummaryById = await buildPlayerSummaryById([player1Id, player2Id]);
  return mapTeamSummary(team.toObject(), playerSummaryById);
};

const pickPartner = async (tournamentId, userId, partnerPlayerId) => {
  const { materializeApprovedPlayerForUser } = require('./tournament');
  await materializeApprovedPlayerForUser(tournamentId, userId);

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (!isDoublesTournament(tournament)) {
    throw new ApiError(409, 'SINGLES_TOURNAMENT', 'Partner picking is only available in doubles tournaments');
  }

  const actor = await getActivePlayerForUser(tournamentId, userId);
  const partner = await Player.findOne({
    _id: partnerPlayerId,
    tournamentId,
    status: 'active',
  }).lean();

  if (!partner) {
    throw new ApiError(404, 'PARTNER_NOT_FOUND', 'Partner must be an approved player in this tournament');
  }

  if (String(partner._id) === String(actor._id)) {
    throw new ApiError(400, 'INVALID_PARTNER', 'You cannot pick yourself as a partner');
  }

  if (actor.teamId || partner.teamId) {
    throw new ApiError(409, 'ALREADY_TEAMED', 'Both players must be solo before forming a team');
  }

  return createTeamFromPlayers(tournamentId, actor._id, partner._id);
};

const breakTeam = async (tournamentId, userId, teamId) => {
  const team = await Team.findOne({ _id: teamId, tournamentId, status: 'active' });
  if (!team) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }

  await assertHostOrTeamMember(tournamentId, userId, team);

  team.status = 'dissolved';
  await team.save();

  await Player.updateMany(
    { _id: { $in: [team.player1Id, team.player2Id] } },
    { $set: { teamId: null, awaitingPartner: false } }
  );

  return { teamId: String(teamId), dissolved: true };
};

const hostFormTeam = async (tournamentId, hostUserId, payload = {}) => {
  await materializeRosterPlayers(tournamentId);

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (String(tournament.hostUserId) !== String(hostUserId)) {
    throw new ApiError(403, 'HOST_ONLY', 'Only the host can form teams on behalf of players');
  }

  if (!isDoublesTournament(tournament)) {
    throw new ApiError(409, 'SINGLES_TOURNAMENT', 'Teams are only used in doubles tournaments');
  }

  const player1Id = String(payload.player1Id || '').trim();
  const player2Id = String(payload.player2Id || '').trim();

  return createTeamFromPlayers(tournamentId, player1Id, player2Id, {
    customDisplayName: payload.customDisplayName,
  });
};

const updateTeamDisplayName = async (tournamentId, userId, teamId, payload = {}) => {
  const team = await Team.findOne({ _id: teamId, tournamentId, status: 'active' });
  if (!team) {
    throw new ApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
  }

  await assertHostOrTeamMember(tournamentId, userId, team);

  const trimmedCustom = String(payload.customDisplayName || '').trim();
  const players = await Player.find({ _id: { $in: [team.player1Id, team.player2Id] } }).lean();
  const playerById = new Map(players.map((player) => [String(player._id), player]));
  const defaultName = buildDefaultTeamDisplayName(
    playerById.get(String(team.player1Id)),
    playerById.get(String(team.player2Id))
  );

  if (!trimmedCustom) {
    team.customDisplayName = null;
    team.displayName = defaultName;
  } else {
    team.customDisplayName = trimmedCustom;
    team.displayName = trimmedCustom;
  }

  await team.save();

  const playerSummaryById = await buildPlayerSummaryById([team.player1Id, team.player2Id]);
  return mapTeamSummary(team.toObject(), playerSummaryById);
};

const shuffleArray = (items = []) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = nextItems[index];
    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = temp;
  }

  return nextItems;
};

const randomPairSolos = async (tournamentId, hostUserId) => {
  await materializeRosterPlayers(tournamentId);

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (String(tournament.hostUserId) !== String(hostUserId)) {
    throw new ApiError(403, 'HOST_ONLY', 'Only the host can random-pair players');
  }

  const solos = await Player.find({
    tournamentId,
    status: 'active',
    teamId: null,
  }).lean();

  const shuffled = shuffleArray(solos);
  const createdTeams = [];

  for (let index = 0; index + 1 < shuffled.length; index += 2) {
    const team = await createTeamFromPlayers(tournamentId, shuffled[index]._id, shuffled[index + 1]._id);
    createdTeams.push(team);
  }

  let byePlayer = null;
  if (shuffled.length % 2 === 1) {
    const leftover = shuffled[shuffled.length - 1];
    await Player.updateOne({ _id: leftover._id }, { $set: { awaitingPartner: true } });
    byePlayer = {
      playerId: String(leftover._id),
      displayName: leftover.displayName,
    };
  }

  return { teams: createdTeams, byePlayer };
};

const resolveDoublesPairingForGroupAssign = async (tournamentId) => {
  const solos = await Player.find({
    tournamentId,
    status: 'active',
    teamId: null,
  }).lean();

  if (solos.length === 0) {
    return;
  }

  if (solos.length === 1) {
    await Player.updateOne({ _id: solos[0]._id }, { $set: { awaitingPartner: true } });
    return;
  }

  throw new ApiError(
    409,
    'UNPAIRED_PLAYERS',
    `${solos.length} players are not on a team. Pair them, random-pair, or leave exactly one bye player before assigning groups.`
  );
};

const pairByeWithPlayer = async (tournamentId, hostUserId, newPlayerId) => {
  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (String(tournament.hostUserId) !== String(hostUserId)) {
    throw new ApiError(403, 'HOST_ONLY', 'Only the host can pair bye players');
  }

  const byePlayer = await Player.findOne({
    tournamentId,
    status: 'active',
    teamId: null,
    awaitingPartner: true,
  }).lean();

  if (!byePlayer) {
    throw new ApiError(409, 'NO_BYE_PLAYER', 'No player is currently marked as awaiting a partner');
  }

  const newPlayer = await Player.findOne({
    _id: newPlayerId,
    tournamentId,
    status: 'active',
    teamId: null,
  }).lean();

  if (!newPlayer) {
    throw new ApiError(404, 'PLAYER_NOT_FOUND', 'New player must be an active solo participant');
  }

  if (String(newPlayer._id) === String(byePlayer._id)) {
    throw new ApiError(400, 'INVALID_PAIR', 'Cannot pair a player with themselves');
  }

  return createTeamFromPlayers(tournamentId, byePlayer._id, newPlayer._id);
};

const buildTeamSummaryById = async (teamIds = []) => {
  const normalized = [...new Set(teamIds.map((value) => String(value)).filter(Boolean))];
  if (normalized.length === 0) {
    return new Map();
  }

  const teams = await Team.find({ _id: { $in: normalized } }).lean();
  const playerIds = teams.flatMap((team) => [team.player1Id, team.player2Id]);
  const playerSummaryById = await buildPlayerSummaryById(playerIds);

  return teams.reduce((acc, team) => {
    acc.set(String(team._id), mapTeamSummary(team, playerSummaryById));
    return acc;
  }, new Map());
};

module.exports = {
  isDoublesTournament,
  buildDefaultTeamDisplayName,
  buildPlayerSummaryById,
  buildTeamSummaryById,
  mapTeamSummary,
  listTournamentTeams,
  listSoloPlayers,
  pickPartner,
  breakTeam,
  hostFormTeam,
  updateTeamDisplayName,
  randomPairSolos,
  resolveDoublesPairingForGroupAssign,
  pairByeWithPlayer,
  createTeamFromPlayers,
};
