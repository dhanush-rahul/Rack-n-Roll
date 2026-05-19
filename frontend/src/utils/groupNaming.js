export const getMajorSequenceLabel = (index) => {
  let nextIndex = Number(index) || 0;
  let label = '';

  do {
    label = String.fromCharCode(65 + (nextIndex % 26)) + label;
    nextIndex = Math.floor(nextIndex / 26) - 1;
  } while (nextIndex >= 0);

  return label;
};

export const buildGroupDisplayName = (index) => `Group ${getMajorSequenceLabel(index)}`;

export const buildDivisionOrderIndex = (games = []) => {
  const divisionMeta = new Map();

  (games || []).forEach((game) => {
    const divisionId = String(game?.divisionId || '').trim();

    if (!divisionId) {
      return;
    }

    if (!divisionMeta.has(divisionId)) {
      divisionMeta.set(divisionId, String(game?.divisionName || '').trim());
    }
  });

  return new Map(
    [...divisionMeta.entries()]
      .sort((left, right) => {
        const nameOrder = left[1].localeCompare(right[1]);

        if (nameOrder !== 0) {
          return nameOrder;
        }

        return left[0].localeCompare(right[0]);
      })
      .map(([divisionId], index) => [divisionId, index])
  );
};

export const resolveGroupSectionName = ({
  divisionId,
  divisionGames = [],
  divisionNameById = new Map(),
  divisionOrderIndex = new Map(),
  sectionIndex = 0,
}) => {
  const normalizedDivisionId = String(divisionId || '').trim();
  const fromMap = divisionNameById.get(normalizedDivisionId);

  if (fromMap) {
    return fromMap;
  }

  const fromGame = String(divisionGames[0]?.divisionName || '').trim();

  if (fromGame) {
    return fromGame;
  }

  if (normalizedDivisionId === '__ungrouped') {
    return 'Ungrouped';
  }

  const orderIndex = divisionOrderIndex.get(normalizedDivisionId);

  if (orderIndex !== undefined) {
    return buildGroupDisplayName(orderIndex);
  }

  return buildGroupDisplayName(sectionIndex);
};
