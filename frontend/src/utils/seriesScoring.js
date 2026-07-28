export const MAX_SERIES_SCORE_ROWS = 7;

export function getSeriesScoringMeta({
  scoreInput,
  matchBestOf,
  configuredBestOf = 1,
  entryCount,
} = {}) {
  const entriesLength = entryCount ?? (scoreInput?.entries || []).length;
  const seriesTargetBestOf = Math.max(
    Number(scoreInput?.seriesMaxGames || 0),
    Number(matchBestOf || 1),
    Number(configuredBestOf || 1),
    1
  );

  return {
    seriesTargetBestOf,
    isSeriesAtLimit: entriesLength >= MAX_SERIES_SCORE_ROWS,
    maxScoreRows: MAX_SERIES_SCORE_ROWS,
  };
}

export function getScoreEntryWinner(entry) {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return null;
  }

  if (playerAScore === 0 && playerBScore === 0) {
    return null;
  }

  if (playerAScore > playerBScore) {
    return 'a';
  }

  if (playerBScore > playerAScore) {
    return 'b';
  }

  return null;
}

export function isPlayedScoreEntry(entry) {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
}

export function resolveMatchStatusFromScoreEntries({
  entries = [],
  bestOf = 1,
  scoringStyle = 'individualGames',
} = {}) {
  const playedEntries = (entries || []).filter((entry) => isPlayedScoreEntry(entry));

  if (playedEntries.length === 0) {
    return 'scheduled';
  }

  const normalizedBestOf = Math.max(Number(bestOf) || 1, 1);

  let scoreForA = 0;
  let scoreForB = 0;

  playedEntries.forEach((entry) => {
    scoreForA += Number(entry.playerAScore);
    scoreForB += Number(entry.playerBScore);
  });

  if (scoringStyle === 'totalPoints') {
    return 'completed';
  }

  if (playedEntries.length >= normalizedBestOf) {
    return 'completed';
  }

  return 'inProgress';
}

export function getSeriesWinnerSide({
  entries = [],
  bestOf = 1,
  scoringStyle = 'individualGames',
  match,
} = {}) {
  const normalizedBestOf = Math.max(Number(bestOf) || 1, 1);

  const winnerId = String(match?.winnerPlayerId || match?.winnerTeamId || '').trim();
  if (winnerId) {
    const playerAId = String(match?.playerAId || match?.playerA?.id || match?.teamAId || match?.teamA?.id || '');
    const playerBId = String(match?.playerBId || match?.playerB?.id || match?.teamBId || match?.teamB?.id || '');

    if (playerAId && winnerId === playerAId) {
      return 'a';
    }

    if (playerBId && winnerId === playerBId) {
      return 'b';
    }
  }

  const persistedWinsA = Number(match?.playerASeriesWins);
  const persistedWinsB = Number(match?.playerBSeriesWins);
  const matchComplete =
    match?.status === 'completed' || Boolean(match?.winnerPlayerId || match?.winnerTeamId);

  if (matchComplete && Number.isFinite(persistedWinsA) && Number.isFinite(persistedWinsB)) {
    if (persistedWinsA > persistedWinsB) {
      return 'a';
    }

    if (persistedWinsB > persistedWinsA) {
      return 'b';
    }

    return null;
  }

  if (scoringStyle === 'totalPoints') {
    const entry = entries[0];
    const playerAScore = Number(entry?.playerAScore);
    const playerBScore = Number(entry?.playerBScore);

    if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
      return null;
    }

    if (playerAScore === 0 && playerBScore === 0) {
      return null;
    }

    if (playerAScore > playerBScore) {
      return 'a';
    }

    if (playerBScore > playerAScore) {
      return 'b';
    }

    return null;
  }

  const playedEntries = (entries || []).filter((entry) => isPlayedScoreEntry(entry));

  if (playedEntries.length < normalizedBestOf) {
    return null;
  }

  let scoreForA = 0;
  let scoreForB = 0;

  playedEntries.forEach((entry) => {
    scoreForA += Number(entry.playerAScore);
    scoreForB += Number(entry.playerBScore);
  });

  if (scoreForA > scoreForB) {
    return 'a';
  }

  if (scoreForB > scoreForA) {
    return 'b';
  }

  return null;
}
