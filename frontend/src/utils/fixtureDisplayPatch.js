import { mapGameToDisplayMatch } from './fixtureDisplay';

const displayMatchPatchKey = (match) =>
  [
    match?.status,
    match?.playerASeriesWins,
    match?.playerBSeriesWins,
    match?.completedGamesCount,
    match?.scheduledStartAt,
    match?.matchDurationMs,
    JSON.stringify(match?.scoreEntries || []),
  ].join('|');

/** Update score/status fields in existing sections without rebuilding round structure. */
export function patchDisplaySectionsFromGames(
  sections = [],
  games = [],
  { groupStageBestOf = 1, isPlayedScoreEntry = () => false } = {}
) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return sections;
  }

  const gamesById = new Map(
    (games || []).map((game) => [String(game.id || game.gameId || ''), game]).filter(([id]) => id)
  );

  if (gamesById.size === 0) {
    return sections;
  }

  let changed = false;

  const nextSections = sections.map((section) => {
    let sectionChanged = false;

    const nextRounds = (section.rounds || []).map((round) => {
      let roundChanged = false;

      const nextMatches = (round.matches || []).map((match) => {
        const matchId = String(match.gameId || match.id || '');
        const game = gamesById.get(matchId);

        if (!game) {
          return match;
        }

        const patched = {
          ...mapGameToDisplayMatch(game, { groupStageBestOf, isPlayedScoreEntry }),
          matchNumber: match.matchNumber,
          roundNumber: match.roundNumber ?? round.roundNumber,
        };

        if (displayMatchPatchKey(match) === displayMatchPatchKey(patched)) {
          return match;
        }

        roundChanged = true;
        return patched;
      });

      if (!roundChanged) {
        return round;
      }

      sectionChanged = true;
      return { ...round, matches: nextMatches };
    });

    if (!sectionChanged) {
      return section;
    }

    changed = true;
    return { ...section, rounds: nextRounds };
  });

  return changed ? nextSections : sections;
}

export function buildFixtureGameIdsKey(games = []) {
  return (games || [])
    .map((game) => String(game.id || game.gameId || ''))
    .filter(Boolean)
    .join('|');
}
