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

export function getSeriesWinnerSide({
  entries = [],
  bestOf = 1,
  scoringStyle = 'individualGames',
  match,
} = {}) {
  const normalizedBestOf = Math.max(Number(bestOf) || 1, 1);
  const winsRequired = Math.floor(normalizedBestOf / 2) + 1;

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

  if (Number.isFinite(persistedWinsA) && persistedWinsA >= winsRequired) {
    return 'a';
  }

  if (Number.isFinite(persistedWinsB) && persistedWinsB >= winsRequired) {
    return 'b';
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

  let winsA = 0;
  let winsB = 0;

  for (const entry of entries) {
    const gameWinner = getScoreEntryWinner(entry);
    if (gameWinner === 'a') {
      winsA += 1;
    } else if (gameWinner === 'b') {
      winsB += 1;
    }
  }

  if (winsA >= winsRequired) {
    return 'a';
  }

  if (winsB >= winsRequired) {
    return 'b';
  }

  return null;
}
