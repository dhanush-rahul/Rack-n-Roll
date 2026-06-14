import { fetchTournamentScoresheet } from '../../services/tournamentService';

export async function fetchAllScoresheetPages(tournamentId, params = {}) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  let firstPageMeta = null;

  while (page <= totalPages) {
    const response = await fetchTournamentScoresheet(tournamentId, {
      ...params,
      page,
      pageSize: 100,
    });

    if (page === 1) {
      firstPageMeta = response;
      totalPages = Math.max(response.pagination?.totalPages || 0, 1);

      if ((response.pagination?.totalPages || 0) === 0) {
        totalPages = 0;
      }
    }

    items.push(...(response.items || []));

    if (totalPages === 0) {
      break;
    }

    page += 1;
  }

  return {
    items,
    canEdit: Boolean(firstPageMeta?.canEdit),
    groupStageProctored: Boolean(firstPageMeta?.groupStageProctored),
    finalStageProctored: Boolean(firstPageMeta?.finalStageProctored),
    format: firstPageMeta?.format,
    pairFormationMode: firstPageMeta?.pairFormationMode,
    progressionState: firstPageMeta?.progressionState,
    proctors: firstPageMeta?.proctors || [],
    proctorTransferRequest: firstPageMeta?.proctorTransferRequest || null,
    pagination: firstPageMeta?.pagination || { total: items.length, totalPages: 1, page: 1, pageSize: 100 },
  };
}
