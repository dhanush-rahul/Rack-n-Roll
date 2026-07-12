const Division = require('../../models/division.model');
const { recomputeLeaderboardForScope, listTournamentLeaderboard } = require('./leaderboard.service');

const shuffleIds = (ids = []) => {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const getGroupDivisions = async (tournamentId) => {
  const divisions = await Division.find({ tournamentId, stageId: null })
    .sort({ name: 1, _id: 1 })
    .lean();

  return divisions.filter((division) => String(division.name || '') !== 'Final Stage' && !division.stageId);
};

const rankGroupParticipants = async (tournament, division, isDoubles, topPerGroup, selectedIds = []) => {
  if (selectedIds.length > 0) {
    const allowed = new Set(
      (isDoubles ? division.teamIds : division.playerIds || []).map((id) => String(id))
    );
    const ids = selectedIds.filter((id) => allowed.has(String(id)));
    return { ids, standingsCount: ids.length };
  }

  if (isDoubles) {
    await recomputeLeaderboardForScope(tournament._id, division._id);
    const teamLeaderboard = await listTournamentLeaderboard(tournament._id, division._id, 'team');
    const topItems = (teamLeaderboard.items || []).slice(0, topPerGroup);
    const rankedFromStandings = topItems.map((entry) => String(entry.teamId));
    const standingsCount = rankedFromStandings.length;
    if (rankedFromStandings.length >= topPerGroup) {
      return { ids: rankedFromStandings, standingsCount };
    }

    const rosterIds = (division.teamIds || []).map((id) => String(id)).filter(Boolean);
    const extras = rosterIds.filter((id) => !rankedFromStandings.includes(id));
    return {
      ids: [...rankedFromStandings, ...extras].slice(0, topPerGroup),
      standingsCount,
    };
  }

  const leaderboard = await recomputeLeaderboardForScope(tournament._id, division._id);
  const topItems = (leaderboard.items || []).slice(0, topPerGroup);
  const rankedFromStandings = topItems.map((entry) => String(entry.playerId));
  const standingsCount = rankedFromStandings.length;
  if (rankedFromStandings.length >= topPerGroup) {
    return { ids: rankedFromStandings, standingsCount };
  }

  const rosterIds = (division.playerIds || []).map((id) => String(id)).filter(Boolean);
  const extras = rosterIds.filter((id) => !rankedFromStandings.includes(id));
  return {
    ids: [...rankedFromStandings, ...extras].slice(0, topPerGroup),
    standingsCount,
  };
};

const splitGroupAdvancement = async (tournament, stage, isDoubles, selectedIds = []) => {
  const groupDivisions = await getGroupDivisions(tournament._id);
  const topPerGroup = Math.max(Number(stage.advancement?.topPerGroup || 2), 1);
  const directPromotePerGroup = Math.max(Number(stage.advancement?.directPromotePerGroup || 0), 0);
  const poolMode = stage.advancement?.poolMode || 'combined';
  const bypassTargetStageName = String(stage.advancement?.bypassTargetStageName || '').trim() || null;

  const rankedByGroup = [];
  for (const division of groupDivisions) {
    const playingPerGroup = Math.max(topPerGroup - directPromotePerGroup, 0);
    const autoRanked = await rankGroupParticipants(tournament, division, isDoubles, topPerGroup, []);
    const bypassIds = autoRanked.ids.slice(0, directPromotePerGroup);

    let playingIds = [];
    let rankedIds = autoRanked.ids;
    let standingsCount = autoRanked.standingsCount;

    if (selectedIds.length > 0) {
      const allowed = new Set(
        (isDoubles ? division.teamIds : division.playerIds || []).map((id) => String(id))
      );
      const bypassIdSet = new Set(bypassIds.map(String));
      playingIds = selectedIds
        .map(String)
        .filter((id) => allowed.has(id) && !bypassIdSet.has(id));
      rankedIds = [...bypassIds, ...playingIds];
      standingsCount = autoRanked.standingsCount;
    } else {
      playingIds = rankedIds.slice(directPromotePerGroup);
    }

    rankedByGroup.push({
      divisionId: String(division._id),
      divisionName: division.name || 'Group',
      rankedIds,
      bypassIds,
      playingIds,
      standingsCount,
      standingsReadyCount: Math.min(
        playingPerGroup,
        Math.max(standingsCount - directPromotePerGroup, 0)
      ),
      rosterCount: (isDoubles ? division.teamIds : division.playerIds || []).length,
    });
  }

  const bypassIds = [...new Set(rankedByGroup.flatMap((group) => group.bypassIds))];
  const pools = [];

  if (poolMode === 'groupPairKnockout') {
    if (rankedByGroup.length % 2 !== 0) {
      const ApiError = require('../../utils/ApiError');
      throw new ApiError(409, 'GROUP_PAIR_REQUIRES_EVEN_GROUPS', 'Group-pair knockout requires an even number of groups');
    }

    for (let index = 0; index < rankedByGroup.length; index += 2) {
      const left = rankedByGroup[index];
      const right = rankedByGroup[index + 1];
      const participantIds = [...left.playingIds, ...right.playingIds];
      if (participantIds.length < 2) {
        continue;
      }
      pools.push({
        key: `${left.divisionName}-${right.divisionName}`,
        label: `${left.divisionName} vs ${right.divisionName}`,
        participantIds,
      });
    }
  } else {
    let participantIds = rankedByGroup.flatMap((group) => group.playingIds);
    if (poolMode === 'randomKnockout') {
      participantIds = shuffleIds(participantIds);
    }
    if (participantIds.length >= 2) {
      pools.push({
        key: poolMode === 'randomKnockout' ? 'random' : 'combined',
        label: poolMode === 'randomKnockout' ? 'Random knockout' : 'All qualifiers',
        participantIds,
      });
    }
  }

  return {
    bypassIds,
    bypassTargetStageName,
    pools,
    rankedByGroup,
    poolMode,
  };
};

const mergeBypassParticipants = (tournament, stageName, suggestedIds = []) => {
  const normalizedName = String(stageName || '').trim().toLowerCase();
  if (!normalizedName) {
    return [...new Set(suggestedIds.map(String))];
  }

  const bypassEntries = tournament?.progressionBypass || [];
  const matchedBypass = bypassEntries
    .filter((entry) => String(entry.targetStageName || '').trim().toLowerCase() === normalizedName)
    .flatMap((entry) => entry.participantIds || []);

  return [...new Set([...matchedBypass.map(String), ...suggestedIds.map(String)])];
};

module.exports = {
  getGroupDivisions,
  splitGroupAdvancement,
  mergeBypassParticipants,
  shuffleIds,
};
