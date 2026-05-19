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

export const mapGameToDisplayMatch = (game, { groupStageBestOf = 1, isPlayedScoreEntry } = {}) => {
  const configuredBestOf = Math.max(Number(groupStageBestOf || 1), 1);
  const bestOf = Math.max(Number(game.bestOf || 1), configuredBestOf);
  const playedEntryCount = Array.isArray(game.scoreEntries)
    ? game.scoreEntries.filter((entry) => (isPlayedScoreEntry ? isPlayedScoreEntry(entry) : false)).length
    : 0;

  return {
    matchNumber: Number(game.matchNumber || 0),
    gameId: game.id,
    bestOf,
    status: game.status || 'scheduled',
    completedGamesCount: Math.min(playedEntryCount, bestOf),
    playerA: {
      id: game.playerA?.userId || game.playerA?.id || game.playerAId,
      name: game.playerA?.displayName || game.playerAId,
    },
    playerB: {
      id: game.playerB?.userId || game.playerB?.id || game.playerBId,
      name: game.playerB?.displayName || game.playerBId,
    },
  };
};

const extractParticipantsFromGames = (games = []) => {
  const playersById = new Map();

  games.forEach((game) => {
    const sides = [
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
