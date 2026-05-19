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
