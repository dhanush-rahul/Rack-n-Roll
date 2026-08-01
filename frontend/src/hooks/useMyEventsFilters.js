import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export const MY_EVENTS_ROLE_FILTER_OPTIONS = [
  { id: 'hosting', label: 'Hosting' },
  { id: 'playing', label: 'Playing' },
  { id: 'pending', label: 'Pending approval' },
];

export const MY_EVENTS_FILTER_OPTIONS = [
  { id: 'all', label: 'All events' },
  ...MY_EVENTS_ROLE_FILTER_OPTIONS,
];

export const MY_EVENTS_SORT_OPTIONS = [
  { id: 'activity', label: 'Recent activity' },
  { id: 'startsSoon', label: 'Starting soon' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'newest', label: 'Newest added' },
];

export const PAGE_SIZE_OPTIONS = [10, 20, 30];
export const SEARCH_DEBOUNCE_MS = 350;
export const FILTERS_PANEL_MAX_HEIGHT = 380;

const countActiveFilters = ({ searchQuery, sortId, filterIds, pageSize }) => {
  let count = 0;
  if (searchQuery.trim()) count += 1;
  if (sortId !== 'activity') count += 1;
  if ((filterIds || []).length > 0) count += 1;
  if (pageSize !== 10) count += 1;
  return count;
};

export function matchesMyEventsRoleFilters(item, filterIds = []) {
  if (!filterIds.length) {
    return true;
  }

  const isHost = (item.roles || []).includes('host');
  const isPending = item.currentUserRegistrationStatus === 'underReview';

  return filterIds.some((filterId) => {
    if (filterId === 'hosting') return isHost;
    if (filterId === 'playing') return !isHost && !isPending;
    if (filterId === 'pending') return isPending;
    return false;
  });
}

export function serializeMyEventsFilters(filterIds = []) {
  const normalized = [...new Set((filterIds || []).filter((value) => value && value !== 'all'))];
  return normalized.length > 0 ? normalized.join(',') : 'all';
}

export function filterAndSortMyEvents(items, { searchQuery, sortId, filterIds }) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  let nextItems = items.filter((item) => {
    if (!matchesMyEventsRoleFilters(item, filterIds)) {
      return false;
    }

    if (normalizedSearch && !String(item.name || '').toLowerCase().includes(normalizedSearch)) {
      return false;
    }

    return true;
  });

  nextItems = [...nextItems].sort((left, right) => {
    if (sortId === 'startsSoon') {
      return new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime();
    }

    if (sortId === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }

    if (sortId === 'newest') {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    }

    return new Date(right.lastMatchActivityAt || 0).getTime() - new Date(left.lastMatchActivityAt || 0).getTime();
  });

  return nextItems;
}

export function useMyEventsFilters() {
  const [filterIds, setFilterIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortId, setSortId] = useState('activity');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersPanelAnimation = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const debounceMs = searchQuery.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, debounceMs);
    return () => clearTimeout(timerId);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [sortId, filterIds]);

  const onFilterToggle = useCallback((nextFilterId) => {
    if (nextFilterId === 'all') {
      setFilterIds([]);
      setPage(1);
      return;
    }

    setFilterIds((current) => {
      const hasFilter = current.includes(nextFilterId);
      return hasFilter ? current.filter((id) => id !== nextFilterId) : [...current, nextFilterId];
    });
    setPage(1);
  }, []);

  const onPageSizeChange = useCallback((size) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const onPageChange = useCallback((nextPage) => {
    setPage(nextPage);
  }, []);

  const onToggleFiltersPanel = useCallback(() => {
    const nextExpanded = !filtersExpanded;
    setFiltersExpanded(nextExpanded);
    filtersPanelAnimation.stopAnimation();
    Animated.timing(filtersPanelAnimation, {
      toValue: nextExpanded ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [filtersExpanded, filtersPanelAnimation]);

  const activeFilterCount = useMemo(
    () => countActiveFilters({ searchQuery, sortId, filterIds, pageSize }),
    [filterIds, pageSize, searchQuery, sortId]
  );

  const filterParam = useMemo(() => serializeMyEventsFilters(filterIds), [filterIds]);

  return {
    filterIds,
    filterParam,
    searchQuery,
    debouncedSearchQuery,
    sortId,
    setSortId,
    filtersExpanded,
    filtersPanelAnimation,
    page,
    pageSize,
    activeFilterCount,
    onFilterToggle,
    onPageSizeChange,
    onPageChange,
    onToggleFiltersPanel,
    setSearchQuery,
  };
}
