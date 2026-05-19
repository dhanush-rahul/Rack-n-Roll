const normalize = (value) => String(value || '').toLowerCase();

const normalizeLoose = (value) => normalize(value).replace(/[^a-z0-9]/g, '');

const isSubsequence = (source, query) => {
  if (!query) {
    return false;
  }

  let sourceIndex = 0;
  let queryIndex = 0;

  while (sourceIndex < source.length && queryIndex < query.length) {
    if (source[sourceIndex] === query[queryIndex]) {
      queryIndex += 1;
    }

    sourceIndex += 1;
  }

  return queryIndex === query.length;
};

export const includesLoose = (source, query) => {
  const strictQuery = normalize(query).trim();

  if (!strictQuery) {
    return false;
  }

  const strictSource = normalize(source);

  if (strictSource.includes(strictQuery)) {
    return true;
  }

  const looseSource = normalizeLoose(source);
  const looseQuery = normalizeLoose(query);

  if (looseSource.includes(looseQuery)) {
    return true;
  }

  return isSubsequence(looseSource, looseQuery);
};

export const buildPlayerHaystack = (player = {}, playerId = '') =>
  [
    player.displayName,
    player.name,
    player.userId,
    player.id,
    playerId,
  ]
    .filter(Boolean)
    .join(' ');

export const buildPlayerSearchIndex = (groupsTabItems = [], games = []) => {
  const index = new Map();

  const addPlayer = (playerId, payload = {}) => {
    const normalizedPlayerId = String(playerId || '').trim();

    if (!normalizedPlayerId) {
      return;
    }

    const existing = index.get(normalizedPlayerId) || {};

    index.set(normalizedPlayerId, {
      ...existing,
      ...payload,
      displayName: payload.displayName || existing.displayName || '',
      userId: payload.userId || existing.userId || '',
    });
  };

  (games || []).forEach((game) => {
    addPlayer(game.playerAId, {
      displayName: game.playerA?.displayName,
      userId: game.playerA?.userId,
      divisionId: game.divisionId,
      divisionName: game.divisionName,
    });
    addPlayer(game.playerBId, {
      displayName: game.playerB?.displayName,
      userId: game.playerB?.userId,
      divisionId: game.divisionId,
      divisionName: game.divisionName,
    });
  });

  (groupsTabItems || []).forEach((group) => {
    (group.standings || []).forEach((entry) => {
      addPlayer(entry.playerId, {
        displayName: entry.player?.displayName,
        userId: entry.player?.userId,
        divisionId: group.divisionId,
        divisionName: group.divisionName,
      });
    });
  });

  return index;
};

export const resolvePlayerIdsForQuery = (query, playerSearchIndex = new Map()) => {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return [];
  }

  const matchingIds = [];

  playerSearchIndex.forEach((player, playerId) => {
    if (includesLoose(buildPlayerHaystack(player, playerId), normalizedQuery)) {
      matchingIds.push(String(playerId));
    }
  });

  return matchingIds;
};

export const buildGameSideSearchText = (game, side, playerSearchIndex = new Map()) => {
  const isPlayerA = side === 'A';
  const player = isPlayerA ? game?.playerA : game?.playerB;
  const playerId = String((isPlayerA ? game?.playerAId : game?.playerBId) || '').trim();
  const indexedPlayer = playerSearchIndex.get(playerId) || {};

  return buildPlayerHaystack(
    {
      displayName: player?.displayName || indexedPlayer.displayName,
      name: player?.name,
      userId: player?.userId || indexedPlayer.userId,
      id: player?.id,
    },
    playerId
  );
};

export const doesGameSideMatchQuery = (game, side, query, playerSearchIndex = new Map()) => {
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery) {
    return false;
  }

  return includesLoose(buildGameSideSearchText(game, side, playerSearchIndex), normalizedQuery);
};

const doesGameMatchResolvedPlayerIds = (game, playerIds, opponentIds) => {
  const gamePlayerAId = String(game.playerAId || '').trim();
  const gamePlayerBId = String(game.playerBId || '').trim();

  if (playerIds.length > 0 && opponentIds.length > 0) {
    return playerIds.some(
      (playerId) =>
        opponentIds.some(
          (opponentId) =>
            playerId !== opponentId &&
            ((gamePlayerAId === playerId && gamePlayerBId === opponentId) ||
              (gamePlayerAId === opponentId && gamePlayerBId === playerId))
        )
    );
  }

  if (playerIds.length > 0) {
    return playerIds.includes(gamePlayerAId) || playerIds.includes(gamePlayerBId);
  }

  if (opponentIds.length > 0) {
    return opponentIds.includes(gamePlayerAId) || opponentIds.includes(gamePlayerBId);
  }

  return true;
};

export const doesGameMatchPlayerFilters = (
  game,
  playerQuery,
  player2Query,
  playerSearchIndex = new Map()
) => {
  const normalizedPlayerQuery = String(playerQuery || '').trim();
  const normalizedPlayerTwoQuery = String(player2Query || '').trim();

  if (!normalizedPlayerQuery && !normalizedPlayerTwoQuery) {
    return true;
  }

  const resolvedPlayerIds = resolvePlayerIdsForQuery(normalizedPlayerQuery, playerSearchIndex);
  const resolvedOpponentIds = resolvePlayerIdsForQuery(normalizedPlayerTwoQuery, playerSearchIndex);

  if (resolvedPlayerIds.length > 0 || resolvedOpponentIds.length > 0) {
    const matchedByIds = doesGameMatchResolvedPlayerIds(game, resolvedPlayerIds, resolvedOpponentIds);

    if (matchedByIds) {
      return true;
    }

    if (resolvedPlayerIds.length > 0 && normalizedPlayerQuery && !normalizedPlayerTwoQuery) {
      return false;
    }

    if (resolvedOpponentIds.length > 0 && !normalizedPlayerQuery && normalizedPlayerTwoQuery) {
      return false;
    }

    if (resolvedPlayerIds.length > 0 && resolvedOpponentIds.length > 0) {
      return false;
    }
  }

  if (normalizedPlayerQuery && normalizedPlayerTwoQuery) {
    const forward =
      doesGameSideMatchQuery(game, 'A', normalizedPlayerQuery, playerSearchIndex) &&
      doesGameSideMatchQuery(game, 'B', normalizedPlayerTwoQuery, playerSearchIndex);
    const reverse =
      doesGameSideMatchQuery(game, 'B', normalizedPlayerQuery, playerSearchIndex) &&
      doesGameSideMatchQuery(game, 'A', normalizedPlayerTwoQuery, playerSearchIndex);

    return forward || reverse;
  }

  if (normalizedPlayerQuery) {
    return (
      doesGameSideMatchQuery(game, 'A', normalizedPlayerQuery, playerSearchIndex) ||
      doesGameSideMatchQuery(game, 'B', normalizedPlayerQuery, playerSearchIndex)
    );
  }

  if (normalizedPlayerTwoQuery) {
    return (
      doesGameSideMatchQuery(game, 'A', normalizedPlayerTwoQuery, playerSearchIndex) ||
      doesGameSideMatchQuery(game, 'B', normalizedPlayerTwoQuery, playerSearchIndex)
    );
  }

  return true;
};

export const filterGamesByPlayerQueries = (
  games = [],
  playerQuery,
  player2Query,
  { playerSearchIndex = new Map() } = {}
) =>
  games.filter((game) =>
    doesGameMatchPlayerFilters(game, playerQuery, player2Query, playerSearchIndex)
  );
