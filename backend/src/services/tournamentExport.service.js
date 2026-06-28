const ExcelJS = require('exceljs');
const Game = require('../models/game.model');
const Division = require('../models/division.model');
const Player = require('../models/player.model');
const User = require('../models/user.model');
const { computePoolStats } = require('../utils/handicapScoring');
const ApiError = require('../utils/ApiError');
const { sendTournamentExportEmail } = require('./email.service');
const {
  getHostTournamentDetail,
  listGroupStandingsForHost,
} = require('./tournament');
const { listTournamentTeams, buildTeamSummaryById } = require('./team.service');

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
};

const sanitizeFilename = (value) =>
  String(value || 'tournament')
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'tournament';

const formatProgressionLabel = (state) => {
  switch (state) {
    case 'registration':
      return 'Registration';
    case 'groupStage':
      return 'Group stage';
    case 'finalStage':
      return 'Final stage';
    case 'completed':
      return 'Completed';
    default:
      return state || '—';
  }
};

const formatFormatLabel = (format) => (format === 'doubles' ? 'Doubles' : 'Singles');

const formatPairFormationLabel = (mode) => {
  if (mode === 'hostAssigns') {
    return 'Host assigns partners';
  }
  if (mode === 'randomPair') {
    return 'Random pairing';
  }
  return 'Players pick partners';
};

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const computeSeriesFromEntries = (scoreEntries = []) => {
  let playerASeriesWins = 0;
  let playerBSeriesWins = 0;

  scoreEntries.forEach((entry) => {
    const playerAScore = Number(entry?.playerAScore || 0);
    const playerBScore = Number(entry?.playerBScore || 0);

    if (playerAScore > playerBScore) {
      playerASeriesWins += 1;
    } else if (playerBScore > playerAScore) {
      playerBSeriesWins += 1;
    }
  });

  return { playerASeriesWins, playerBSeriesWins };
};

const formatGameScores = (scoreEntries = []) =>
  scoreEntries
    .slice()
    .sort((a, b) => a.gameNumber - b.gameNumber)
    .map((entry) => `G${entry.gameNumber}: ${entry.playerAScore}-${entry.playerBScore}`)
    .join('; ');

const styleHeaderRow = (sheet, columnCount) => {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;

  for (let column = 1; column <= columnCount; column += 1) {
    sheet.getColumn(column).width = 16;
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
};

const addKeyValueSheet = (workbook, sheetName, rows) => {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 48 },
  ];
  styleHeaderRow(sheet, 2);
  rows.forEach((row) => sheet.addRow(row));
  return sheet;
};

const buildPlayerDisplayName = (player) => player?.displayName || '—';

const buildTeamDisplayName = (team) => team?.displayName || '—';

const gatherExportPayload = async (tournamentId, hostUserId) => {
  const [detail, standings, divisions, games] = await Promise.all([
    getHostTournamentDetail(tournamentId, hostUserId),
    listGroupStandingsForHost(tournamentId, hostUserId),
    Division.find({ tournamentId }).select({ _id: 1, name: 1 }).sort({ name: 1, _id: 1 }).lean(),
    Game.find({ tournamentId })
      .sort({ stage: 1, roundNumber: 1, createdAt: 1, _id: 1 })
      .lean(),
  ]);

  const divisionNameById = new Map(
    divisions.map((division) => [String(division._id), division.name])
  );

  const isDoubles = detail.competitionConfig?.format === 'doubles';
  const teams = isDoubles ? await listTournamentTeams(tournamentId) : [];

  const players = await Player.find({ tournamentId, status: 'active' })
    .select({ displayName: 1, handicapEnabled: 1, handicapValue: 1, teamId: 1 })
    .sort({ displayName: 1, _id: 1 })
    .lean();

  const playerSummaryById = new Map(
    players.map((player) => [
      String(player._id),
      {
        displayName: player.displayName,
        handicapEnabled: Boolean(player.handicapEnabled),
        handicapValue: Number(player.handicapValue || 0),
        teamId: player.teamId ? String(player.teamId) : null,
      },
    ])
  );

  const teamSummaryById = isDoubles
    ? await buildTeamSummaryById(games.flatMap((game) => [game.teamAId, game.teamBId].filter(Boolean)))
    : new Map();

  const mapGameRow = (game) => {
    const series = computeSeriesFromEntries(game.scoreEntries || []);
    const isTeamMatch = Boolean(game.teamAId || game.teamBId);
    const sideA = isTeamMatch
      ? buildTeamDisplayName(teamSummaryById.get(String(game.teamAId)))
      : buildPlayerDisplayName(playerSummaryById.get(String(game.playerAId)));
    const sideB = isTeamMatch
      ? buildTeamDisplayName(teamSummaryById.get(String(game.teamBId)))
      : buildPlayerDisplayName(playerSummaryById.get(String(game.playerBId)));

    return {
      group: game.divisionId ? divisionNameById.get(String(game.divisionId)) || '—' : 'Finale',
      stage: game.stage === 'finalStage' ? 'Final stage' : 'Group stage',
      round: Number(game.roundNumber || 1),
      sideA,
      sideB,
      bestOf: Number(game.bestOf || 1),
      seriesScore: `${series.playerASeriesWins}-${series.playerBSeriesWins}`,
      gameScores: formatGameScores(game.scoreEntries || []),
      status: game.status || 'notStarted',
      scheduledStartAt: game.scheduledStartAt ? formatDateTime(game.scheduledStartAt) : 'Not scheduled',
    };
  };

  const mappedGames = games.map(mapGameRow);
  const groupGames = mappedGames.filter((game) => game.stage === 'Group stage');
  const finaleGames = mappedGames.filter((game) => game.stage === 'Final stage');

  return {
    detail,
    standings,
    teams,
    players,
    groupGames,
    finaleGames,
    isDoubles,
    exportedAt: new Date(),
  };
};

const addStandingsSheet = (workbook, sheetName, rows, { includeHandicap = false } = {}) => {
  const columns = [
    { header: 'Group', key: 'group' },
    { header: 'Rank', key: 'rank' },
    { header: 'Name', key: 'name' },
    { header: 'Points', key: 'points' },
    { header: 'W', key: 'wins' },
    { header: 'D', key: 'draws' },
    { header: 'L', key: 'losses' },
    { header: 'Score For', key: 'scoreFor' },
    { header: 'Score Against', key: 'scoreAgainst' },
    { header: 'Diff', key: 'scoreDifferential' },
    { header: 'MP', key: 'matchesPlayed' },
    { header: 'Win%', key: 'winPct' },
    { header: 'PPM', key: 'ppm' },
    { header: 'PAA', key: 'paa' },
  ];

  if (includeHandicap) {
    columns.push({ header: 'HCP', key: 'handicap' });
  }

  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  styleHeaderRow(sheet, columns.length);
  rows.forEach((row) => sheet.addRow(row));
};

const addFixturesSheet = (workbook, sheetName, rows) => {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: 'Group', key: 'group' },
    { header: 'Round', key: 'round' },
    { header: 'Side A', key: 'sideA' },
    { header: 'Side B', key: 'sideB' },
    { header: 'Best Of', key: 'bestOf' },
    { header: 'Series', key: 'seriesScore' },
    { header: 'Game Scores', key: 'gameScores' },
    { header: 'Status', key: 'status' },
    { header: 'Scheduled', key: 'scheduledStartAt' },
  ];
  styleHeaderRow(sheet, 9);
  rows.forEach((row) => sheet.addRow(row));
};

const buildWorkbook = (payload) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rack-n-Roll';
  workbook.created = payload.exportedAt;

  const { detail, standings, teams, players, groupGames, finaleGames, isDoubles } = payload;
  const config = detail.competitionConfig || {};
  const handicapEnabled = Boolean(config.handicapEnabled);

  addKeyValueSheet(workbook, 'Summary', [
    { field: 'Tournament', value: detail.name },
    { field: 'Format', value: formatFormatLabel(config.format) },
    ...(isDoubles
      ? [{ field: 'Partner formation', value: formatPairFormationLabel(config.pairFormationMode) }]
      : []),
    { field: 'Progression', value: formatProgressionLabel(detail.progressionState) },
    { field: 'Registration', value: detail.registrationStatus === 'open' ? 'Open' : 'Closed' },
    { field: 'Approved participants', value: detail.approvedParticipantsCount },
    { field: 'Max participants', value: detail.maxParticipants },
    { field: 'Groups', value: config.groupCount ?? '—' },
    { field: 'Group stage', value: `Best of ${config.groupStageBestOf ?? 1} · double round-robin` },
    {
      field: 'Final stage',
      value: config.finalStageEnabled
        ? `Best of ${config.finalStageBestOf ?? 3} · top ${config.finalStageTopPerGroup ?? 2} per group`
        : 'Disabled',
    },
    { field: 'Handicap scoring', value: handicapEnabled ? 'Enabled' : 'Disabled' },
    { field: 'Venue', value: detail.location?.formattedAddress || detail.location?.city || '—' },
    { field: 'Exported at', value: formatDateTime(payload.exportedAt) },
  ]);

  if (isDoubles) {
    const teamsSheet = workbook.addWorksheet('Teams');
    teamsSheet.columns = [
      { header: 'Team', key: 'team' },
      { header: 'Player 1', key: 'player1' },
      { header: 'Player 2', key: 'player2' },
      { header: 'Group', key: 'group' },
    ];
    styleHeaderRow(teamsSheet, 4);

    const groupByTeamId = new Map();
    standings.groups.forEach((group) => {
      (group.teamStandings || []).forEach((entry) => {
        groupByTeamId.set(String(entry.teamId), group.divisionName);
      });
    });

    teams.forEach((team) => {
      teamsSheet.addRow({
        team: buildTeamDisplayName(team),
        player1: buildPlayerDisplayName(team.player1),
        player2: buildPlayerDisplayName(team.player2),
        group: groupByTeamId.get(String(team.id)) || '—',
      });
    });
  }

  const playersSheet = workbook.addWorksheet(isDoubles ? 'Players' : 'Players');
  playersSheet.columns = isDoubles
    ? [
        { header: 'Player', key: 'player' },
        { header: 'Team', key: 'team' },
        ...(handicapEnabled ? [{ header: 'HCP', key: 'handicap' }] : []),
      ]
    : [
        { header: 'Player', key: 'player' },
        ...(handicapEnabled ? [{ header: 'HCP', key: 'handicap' }] : []),
      ];
  styleHeaderRow(playersSheet, playersSheet.columns.length);

  const teamNameById = new Map(teams.map((team) => [String(team.id), buildTeamDisplayName(team)]));

  players.forEach((player) => {
    const row = {
      player: player.displayName,
      ...(isDoubles
        ? { team: player.teamId ? teamNameById.get(String(player.teamId)) || '—' : 'Solo' }
        : {}),
      ...(handicapEnabled && player.handicapEnabled
        ? { handicap: Number(player.handicapValue || 0) }
        : handicapEnabled
          ? { handicap: '—' }
          : {}),
    };
    playersSheet.addRow(row);
  });

  const standingRows = [];
  const teamStandingRows = [];

  standings.groups.forEach((group) => {
    (group.standings || []).forEach((entry) => {
      const stats = entry.stats || computePoolStats(entry);
      standingRows.push({
        group: group.divisionName,
        rank: entry.rank,
        name: buildPlayerDisplayName(entry.player),
        points: entry.points,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        scoreFor: entry.scoreFor,
        scoreAgainst: entry.scoreAgainst,
        scoreDifferential: entry.scoreDifferential,
        matchesPlayed: stats.matchesPlayed,
        winPct: stats.winPct,
        ppm: stats.ppm,
        paa: stats.paa,
        ...(handicapEnabled ? { handicap: entry.player?.handicapValue ?? '—' } : {}),
      });
    });

    (group.teamStandings || []).forEach((entry) => {
      const stats = entry.stats || computePoolStats(entry);
      teamStandingRows.push({
        group: group.divisionName,
        rank: entry.rank,
        name: buildTeamDisplayName(entry.team),
        points: entry.points,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        scoreFor: entry.scoreFor,
        scoreAgainst: entry.scoreAgainst,
        scoreDifferential: entry.scoreDifferential,
        matchesPlayed: stats.matchesPlayed,
        winPct: stats.winPct,
        ppm: stats.ppm,
        paa: stats.paa,
      });
    });
  });

  if (isDoubles) {
    addStandingsSheet(workbook, 'Team Standings', teamStandingRows);
    addStandingsSheet(workbook, 'Player Standings', standingRows, { includeHandicap: handicapEnabled });
  } else {
    addStandingsSheet(workbook, 'Standings', standingRows, { includeHandicap: handicapEnabled });
  }

  addFixturesSheet(workbook, 'Group Fixtures', groupGames);

  if (finaleGames.length > 0) {
    addFixturesSheet(workbook, 'Finale', finaleGames);
  }

  addKeyValueSheet(workbook, 'Definitions', [
    { field: 'MP', value: 'Matches played (wins + draws + losses)' },
    { field: 'Win%', value: 'Percentage of matches won' },
    { field: 'PPM', value: 'Points per match (match points scored ÷ matches played)' },
    { field: 'PAA', value: 'Points against average (match points allowed ÷ matches played)' },
    { field: 'HCP', value: 'Handicap value when handicap scoring is enabled (lower = stronger)' },
    { field: 'Diff', value: 'Score differential (score for minus score against)' },
  ]);

  return workbook;
};

const exportTournamentWorkbook = async (tournamentId, hostUserId) => {
  const payload = await gatherExportPayload(tournamentId, hostUserId);
  const workbook = buildWorkbook(payload);
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${sanitizeFilename(payload.detail.name)}-export.xlsx`;

  return {
    buffer,
    filename,
    tournamentName: payload.detail.name,
  };
};

const emailTournamentExport = async (tournamentId, hostUserId) => {
  const user = await User.findById(hostUserId).select({ name: 1, email: 1 }).lean();

  if (!user?.email) {
    throw new ApiError(404, 'USER_EMAIL_NOT_FOUND', 'No email address is on file for your account');
  }

  const { buffer, filename, tournamentName } = await exportTournamentWorkbook(tournamentId, hostUserId);
  const delivery = await sendTournamentExportEmail({
    toEmail: user.email,
    toName: user.name,
    tournamentName,
    filename,
    buffer,
  });

  return {
    tournamentId: String(tournamentId),
    tournamentName,
    filename,
    deliveryMode: delivery.deliveryMode,
    sentTo: delivery.sentTo,
  };
};

module.exports = {
  exportTournamentWorkbook,
  emailTournamentExport,
  sanitizeFilename,
};
