import { buildDivisionOrderIndex, resolveGroupSectionName } from './groupNaming';

export const GROUP_STAGE_ROUND_ROBIN_LEGS = 2;

export const buildMatchKey = (playerAId, playerBId) => {
  const left = String(playerAId || '').trim();
  const right = String(playerBId || '').trim();

  if (!left && !right) {
    return '';
  }

  return left < right ? `${left}::${right}` : `${right}::${left}`;
};

const rotateRoundRobinParticipants = (participants) => {
  if (!Array.isArray(participants) || participants.length <= 2) {
    return participants;
  }

  const fixedParticipant = participants[0];
  const rotatingParticipants = participants.slice(1);
  const movedParticipant = rotatingParticipants.pop();

  return [fixedParticipant, movedParticipant, ...rotatingParticipants];
};

export const buildRoundRobinRounds = (participants = [], legs = 1) => {
  if (!Array.isArray(participants) || participants.length < 2) {
    return [];
  }

  const normalizedParticipants = [...participants];

  if (normalizedParticipants.length % 2 === 1) {
    normalizedParticipants.push(null);
  }

  const totalRounds = normalizedParticipants.length - 1;
  let rotatingState = normalizedParticipants;
  const baseRounds = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const roundMatches = [];
    const halfSize = rotatingState.length / 2;

    for (let matchIndex = 0; matchIndex < halfSize; matchIndex += 1) {
      const playerA = rotatingState[matchIndex];
      const playerB = rotatingState[rotatingState.length - 1 - matchIndex];

      if (!playerA || !playerB) {
        continue;
      }

      roundMatches.push({
        matchNumber: matchIndex + 1,
        playerA,
        playerB,
      });
    }

    baseRounds.push({
      roundNumber: roundIndex + 1,
      matches: roundMatches,
    });

    rotatingState = rotateRoundRobinParticipants(rotatingState);
  }

  const normalizedLegs = Number.isInteger(legs) && legs >= 1 ? legs : 1;

  if (normalizedLegs === 1) {
    return baseRounds;
  }

  const rounds = [...baseRounds];

  for (let legIndex = 1; legIndex < normalizedLegs; legIndex += 1) {
    baseRounds.forEach((round) => {
      rounds.push({
        roundNumber: rounds.length + 1,
        matches: round.matches.map((match) => ({
          matchNumber: match.matchNumber,
          playerA: match.playerB,
          playerB: match.playerA,
        })),
      });
    });
  }

  return rounds;
};

export const mergePatternRoundsWithGames = (patternRounds, gameRounds) => {
  if (!Array.isArray(patternRounds) || patternRounds.length === 0) {
    return gameRounds || [];
  }

  if (!Array.isArray(gameRounds) || gameRounds.length === 0) {
    return patternRounds;
  }

  const roundsByNumber = new Map(
    patternRounds.map((round) => [
      Number(round.roundNumber || 1),
      {
        roundNumber: Number(round.roundNumber || 1),
        matches: (round.matches || []).map((match) => ({
          ...match,
          bestOf: Math.max(Number(match.bestOf || 1), 1),
          status: match.status || 'scheduled',
          completedGamesCount: Number(match.completedGamesCount || 0),
        })),
      },
    ])
  );

  gameRounds.forEach((round) => {
    const roundNumber = Number(round.roundNumber || 1);
    const existingPatternRound = roundsByNumber.get(roundNumber);

    if (!existingPatternRound) {
      roundsByNumber.set(roundNumber, round);
      return;
    }

    const mergedByKey = new Map();

    (existingPatternRound.matches || []).forEach((patternMatch, patternMatchIndex) => {
      const matchKey =
        buildMatchKey(patternMatch.playerA?.id, patternMatch.playerB?.id) ||
        `slot:${Number(patternMatch.matchNumber || patternMatchIndex + 1)}`;
      mergedByKey.set(matchKey, patternMatch);
    });

    (round.matches || []).forEach((gameMatch, gameMatchIndex) => {
      const matchKey =
        (gameMatch.gameId ? `game:${String(gameMatch.gameId)}` : '') ||
        buildMatchKey(gameMatch.playerA?.id, gameMatch.playerB?.id) ||
        `slot:${Number(gameMatch.matchNumber || gameMatchIndex + 1)}`;

      const existingMatch = mergedByKey.get(matchKey);

      if (existingMatch) {
        mergedByKey.set(matchKey, { ...existingMatch, ...gameMatch });
        return;
      }

      mergedByKey.set(matchKey, gameMatch);
    });

    roundsByNumber.set(roundNumber, {
      roundNumber,
      matches: [...mergedByKey.values()].sort(
        (left, right) => Number(left.matchNumber || 0) - Number(right.matchNumber || 0)
      ),
    });
  });

  return [...roundsByNumber.values()].sort((left, right) => left.roundNumber - right.roundNumber);
};

export const dedupeRoundMatches = (matches = []) => {
  const seen = new Set();

  return (matches || []).filter((match, index) => {
    const identity = match?.gameId
      ? `game:${String(match.gameId)}`
      : `pair:${buildMatchKey(match?.playerA?.id, match?.playerB?.id)}:${String(match?.matchNumber || index + 1)}`;

    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
};

export const isKnockoutByeGame = (game = {}) => {
  if (game.isBye) {
    return true;
  }

  const playerAId = String(game.playerAId || game.playerA?.id || game.teamAId || game.teamA?.id || '').trim();
  const playerBId = String(game.playerBId || game.playerB?.id || game.teamBId || game.teamB?.id || '').trim();

  return Boolean(playerAId) !== Boolean(playerBId);
};

const resolveMatchDisplayStatus = (game) => {
  const bestOf = Math.max(Number(game.bestOf || 1), 1);
  const winsRequired = Math.floor(bestOf / 2) + 1;
  const winsA = Number(game.playerASeriesWins || 0);
  const winsB = Number(game.playerBSeriesWins || 0);
  const storedStatus = game.status || 'scheduled';

  if (isKnockoutByeGame(game)) {
    return 'bye';
  }

  if (game.winnerPlayerId || game.winnerTeamId || winsA >= winsRequired || winsB >= winsRequired) {
    return 'completed';
  }

  if (storedStatus === 'inProgress') {
    return 'inProgress';
  }

  return storedStatus;
};

const resolveSideDisplay = (game, side) => {
  const isTeamMatch = Boolean(game.teamAId || game.teamBId || game.teamA || game.teamB);

  if (isTeamMatch) {
    const team = side === 'A' ? game.teamA : game.teamB;
    const teamId = side === 'A' ? game.teamAId : game.teamBId;

    return {
      id: team?.id || teamId,
      name: team?.displayName || teamId || (side === 'A' ? 'Team A' : 'Team B'),
    };
  }

  const player = side === 'A' ? game.playerA : game.playerB;
  const playerId = side === 'A' ? game.playerAId : game.playerBId;

  return {
    id: player?.userId || player?.id || playerId,
    name: player?.displayName || playerId,
  };
};

export const mapGameToDisplayMatch = (game, { groupStageBestOf = 1, isPlayedScoreEntry } = {}) => {
  const configuredBestOf = Math.max(Number(groupStageBestOf || 1), 1);
  const bestOf = Math.max(Number(game.bestOf || 1), configuredBestOf);
  const playedEntryCount = Array.isArray(game.scoreEntries)
    ? game.scoreEntries.filter((entry) => (isPlayedScoreEntry ? isPlayedScoreEntry(entry) : false)).length
    : 0;
  const playerA = resolveSideDisplay(game, 'A');
  const playerB = resolveSideDisplay(game, 'B');
  const isTeamMatch = Boolean(game.teamAId || game.teamBId || game.teamA || game.teamB);

  return {
    matchNumber: Number(game.matchNumber || 0),
    id: game.id,
    gameId: game.id,
    stageId: game.stageId ? String(game.stageId) : null,
    stage: game.stage || null,
    tournamentId: game.tournamentId ? String(game.tournamentId) : null,
    bestOf,
    status: resolveMatchDisplayStatus(game),
    isBye: isKnockoutByeGame(game),
    playerASeriesWins: Number(game.playerASeriesWins || 0),
    playerBSeriesWins: Number(game.playerBSeriesWins || 0),
    completedGamesCount: Math.min(playedEntryCount, bestOf),
    playerA,
    playerB,
    isTeamMatch,
    teamAId: game.teamAId ? String(game.teamAId) : null,
    teamBId: game.teamBId ? String(game.teamBId) : null,
    playerAId: game.playerAId ? String(game.playerAId) : null,
    playerBId: game.playerBId ? String(game.playerBId) : null,
    scoreEntries: Array.isArray(game.scoreEntries) ? game.scoreEntries : [],
    canEditMatch: Boolean(game.canEditMatch),
    canScheduleMatch: Boolean(game.canScheduleMatch),
    scheduledStartAt: game.scheduledStartAt || null,
  };
};

const extractParticipantsFromGames = (games = []) => {
  const playersById = new Map();

  games.forEach((game) => {
    const isTeamMatch = Boolean(game.teamAId || game.teamBId || game.teamA || game.teamB);
    const sides = isTeamMatch
      ? [
          {
            id: String(game.teamA?.id || game.teamAId || '').trim(),
            name: game.teamA?.displayName || game.teamAId,
          },
          {
            id: String(game.teamB?.id || game.teamBId || '').trim(),
            name: game.teamB?.displayName || game.teamBId,
          },
        ]
      : [
          {
            id: String(game.playerA?.userId || game.playerA?.id || game.playerAId || '').trim(),
            name: game.playerA?.displayName || game.playerAId,
          },
          {
            id: String(game.playerB?.userId || game.playerB?.id || game.playerBId || '').trim(),
            name: game.playerB?.displayName || game.playerBId,
          },
        ];

    sides.forEach((side) => {
      if (!side.id || playersById.has(side.id)) {
        return;
      }

      playersById.set(side.id, side);
    });
  });

  return [...playersById.values()].sort((left, right) => left.id.localeCompare(right.id));
};

const groupGamesIntoDisplayRounds = (games, mapMatch) => {
  const groupedByRound = games.reduce((accumulator, game) => {
    const roundNumber = Number(game.roundNumber || 1);

    if (!accumulator.has(roundNumber)) {
      accumulator.set(roundNumber, []);
    }

    accumulator.get(roundNumber).push(game);
    return accumulator;
  }, new Map());

  return [...groupedByRound.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([roundNumber, roundGames]) => {
      const sortedRoundGames = [...roundGames].sort((left, right) => {
        const createdAtDelta = String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
        if (createdAtDelta !== 0) {
          return createdAtDelta;
        }

        return String(left.id || '').localeCompare(String(right.id || ''));
      });

      return {
        roundNumber,
        matches: dedupeRoundMatches(
          sortedRoundGames.map((game, index) => ({
            ...mapMatch(game),
            matchNumber: index + 1,
          }))
        ),
      };
    });
};

export const buildFixtureSectionsFromGames = (
  games = [],
  {
    divisionNameById = new Map(),
    divisionOrderIndex = null,
    groupStageBestOf = 1,
    roundRobinLegs = GROUP_STAGE_ROUND_ROBIN_LEGS,
    isPlayedScoreEntry = () => false,
    filterRound,
  } = {}
) => {
  const resolvedDivisionOrderIndex = divisionOrderIndex || buildDivisionOrderIndex(games);
  const byDivision = new Map();

  games.forEach((game) => {
    const divisionId = String(game.divisionId || game.divisionName || '__ungrouped').trim() || '__ungrouped';

    if (!byDivision.has(divisionId)) {
      byDivision.set(divisionId, []);
    }

    byDivision.get(divisionId).push(game);
  });

  const mapMatch = (game) => mapGameToDisplayMatch(game, { groupStageBestOf, isPlayedScoreEntry });

  const sections = [...byDivision.entries()]
    .sort((left, right) => {
      const leftName = divisionNameById.get(left[0]) || gameDivisionLabel(left[0], left[1]);
      const rightName = divisionNameById.get(right[0]) || gameDivisionLabel(right[0], right[1]);
      return leftName.localeCompare(rightName);
    })
    .map(([divisionId, divisionGames], sectionIndex) => {
      const participants = extractParticipantsFromGames(divisionGames);
      const patternRounds = buildRoundRobinRounds(participants, roundRobinLegs).map((round) => ({
        roundNumber: round.roundNumber,
        matches: (round.matches || []).map((match) => ({
          matchNumber: match.matchNumber,
          bestOf: Math.max(Number(groupStageBestOf || 1), 1),
          status: 'scheduled',
          completedGamesCount: 0,
          playerA: match.playerA,
          playerB: match.playerB,
        })),
      }));
      const gameRounds = groupGamesIntoDisplayRounds(divisionGames, mapMatch);
      // Use persisted scoresheet rows only when present. Merging pattern slots with
      // game rows duplicates matches because game rows are keyed by gameId.
      let rounds = divisionGames.length > 0 ? gameRounds : patternRounds;

      if (typeof filterRound === 'function') {
        rounds = filterRound(rounds);
      }

      const sectionName = resolveGroupSectionName({
        divisionId,
        divisionGames,
        divisionNameById,
        divisionOrderIndex: resolvedDivisionOrderIndex,
        sectionIndex,
      });

      return {
        sectionId: divisionId,
        sectionName,
        rounds: rounds.map((round) => ({
          ...round,
          roundKey: `${divisionId}::${round.roundNumber}`,
        })),
        matchCount: rounds.reduce((total, round) => total + (round.matches || []).length, 0),
      };
    });

  return sections;
};

const gameDivisionLabel = (divisionId, games) => {
  const fromGame = String(games[0]?.divisionName || '').trim();
  return fromGame || divisionId;
};

export const flattenFixtureSections = (sections = []) =>
  sections.flatMap((section) => section.rounds || []);

export const countFixtureMatches = (sections = []) =>
  sections.reduce((total, section) => total + Number(section.matchCount || 0), 0);

export const findActiveFixtureRoundKey = (sections = []) => {
  for (const section of sections) {
    const roundKey = findActiveFixtureRoundKeyForSection(section);

    if (roundKey) {
      return roundKey;
    }
  }

  const firstRound = sections[0]?.rounds?.[0];
  return firstRound?.roundKey || null;
};

export const findActiveFixtureRoundKeyForSection = (section) => {
  if (!section) {
    return null;
  }

  const pendingRound = (section.rounds || []).find((round) =>
    (round.matches || []).some((match) => String(match.status || '') !== 'completed')
  );

  if (pendingRound?.roundKey) {
    return pendingRound.roundKey;
  }

  return section.rounds?.[0]?.roundKey || null;
};

const resolveGamePlayerKey = (game, side) => {
  const player = side === 'A' ? game.playerA : game.playerB;
  const playerId = side === 'A' ? game.playerAId : game.playerBId;

  return String(player?.id || playerId || '').trim();
};

const hasRecordedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

const isMatchCountedAsPlayed = (game) => {
  if (String(game.status || '') === 'completed') {
    return true;
  }

  return (Array.isArray(game.scoreEntries) ? game.scoreEntries : []).some((entry) =>
    hasRecordedScoreEntry(entry)
  );
};

export const buildPlayerGameStatsFromGames = (games = []) => {
  const gameStatsByPlayerId = {};

  games.forEach((game) => {
    const playerAKey = resolveGamePlayerKey(game, 'A');
    const playerBKey = resolveGamePlayerKey(game, 'B');
    const isPlayed = isMatchCountedAsPlayed(game);

    [playerAKey, playerBKey].forEach((playerKey) => {
      if (!playerKey) {
        return;
      }

      if (!gameStatsByPlayerId[playerKey]) {
        gameStatsByPlayerId[playerKey] = {
          totalGames: 0,
          gamesPlayed: 0,
          gamesRemaining: 0,
        };
      }

      gameStatsByPlayerId[playerKey].totalGames += 1;

      if (isPlayed) {
        gameStatsByPlayerId[playerKey].gamesPlayed += 1;
      }
    });
  });

  Object.keys(gameStatsByPlayerId).forEach((playerKey) => {
    const stats = gameStatsByPlayerId[playerKey];
    stats.gamesRemaining = Math.max(Number(stats.totalGames || 0) - Number(stats.gamesPlayed || 0), 0);
  });

  return gameStatsByPlayerId;
};

const resolveSideParticipant = (game, side, isDoubles) => {
  if (isDoubles) {
    const team = side === 'A' ? game.teamA : game.teamB;
    const teamId = String(side === 'A' ? game.teamAId : game.teamBId || '').trim();
    const id = String(team?.id || teamId || '').trim();

    if (!id) {
      return null;
    }

    return {
      id,
      label: team?.displayName || team?.customDisplayName || id,
    };
  }

  const player = side === 'A' ? game.playerA : game.playerB;
  const playerId = String(side === 'A' ? game.playerAId : game.playerBId || '').trim();
  const id = String(player?.id || playerId || '').trim();

  if (!id) {
    return null;
  }

  return {
    id,
    label: player?.displayName || player?.username || id,
  };
};

export const buildKnockoutStandingsFromGames = (games = [], isDoubles = false) => {
  const statsById = new Map();

  const ensureStats = (participant) => {
    if (!participant?.id) {
      return null;
    }

    if (!statsById.has(participant.id)) {
      statsById.set(participant.id, {
        id: participant.id,
        label: participant.label,
        wins: 0,
        losses: 0,
        points: 0,
      });
    }

    return statsById.get(participant.id);
  };

  games.forEach((game) => {
    const sideA = resolveSideParticipant(game, 'A', isDoubles);
    const sideB = resolveSideParticipant(game, 'B', isDoubles);

    if (isKnockoutByeGame(game)) {
      const byeParticipant = sideA || sideB;
      ensureStats(byeParticipant);
      return;
    }

    if (!sideA || !sideB) {
      return;
    }

    ensureStats(sideA);
    ensureStats(sideB);

    const playerASeriesWins = Number(game.playerASeriesWins || 0);
    const playerBSeriesWins = Number(game.playerBSeriesWins || 0);
    const winnerId = String(
      (isDoubles ? game.winnerTeamId : game.winnerPlayerId) ||
        (playerASeriesWins > playerBSeriesWins ? sideA.id : playerBSeriesWins > playerASeriesWins ? sideB.id : '')
    ).trim();

    if (!winnerId || game.status !== 'completed') {
      return;
    }

    const aStats = statsById.get(sideA.id);
    const bStats = statsById.get(sideB.id);

    if (winnerId === sideA.id) {
      aStats.wins += 1;
      aStats.points += 2;
      bStats.losses += 1;
      return;
    }

    if (winnerId === sideB.id) {
      bStats.wins += 1;
      bStats.points += 2;
      aStats.losses += 1;
    }
  });

  return [...statsById.values()]
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      return left.label.localeCompare(right.label);
    })
    .map((entry, index) => {
      if (isDoubles) {
        return {
          rank: index + 1,
          teamId: entry.id,
          displayName: entry.label,
          team: { id: entry.id, displayName: entry.label },
          wins: entry.wins,
          losses: entry.losses,
          points: entry.points,
        };
      }

      return {
        rank: index + 1,
        playerId: entry.id,
        displayName: entry.label,
        player: { displayName: entry.label },
        playerName: entry.label,
        wins: entry.wins,
        losses: entry.losses,
        points: entry.points,
      };
    });
};

export const buildProgressionStandingsSections = ({
  stages = [],
  stageGamesById = {},
  isDoubles = false,
} = {}) => {
  const sortedStages = [...stages].sort(
    (left, right) => Number(right.order || 0) - Number(left.order || 0)
  );

  return sortedStages
    .filter((stage) => stage.status === 'active' || stage.status === 'completed')
    .map((stage) => {
      const games = stageGamesById[stage.stageId] || [];
      const standings = buildKnockoutStandingsFromGames(games, isDoubles);

      return {
        stageId: stage.stageId,
        stageName: stage.name,
        stageOrder: Number(stage.order || 0),
        standings: isDoubles ? [] : standings,
        teamStandings: isDoubles ? standings : [],
      };
    })
    .filter((section) => section.standings.length > 0 || section.teamStandings.length > 0);
};
