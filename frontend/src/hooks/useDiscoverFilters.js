import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export const PAGE_SIZE_OPTIONS = [10, 20, 30];
export const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'mine', label: 'My events' },
];
export const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'startsSoon', label: 'Starting soon' },
  { id: 'startsLatest', label: 'Latest start' },
  { id: 'oldest', label: 'Oldest' },
];
export const SEARCH_DEBOUNCE_MS = 350;
export const FILTERS_PANEL_MAX_HEIGHT = 360;

export const getSortLabel = (sortId) => SORT_OPTIONS.find((option) => option.id === sortId)?.label || 'Newest';
export const getFilterLabel = (filterId) => FILTER_OPTIONS.find((option) => option.id === filterId)?.label || 'All';

export const countActiveFilters = ({ searchQuery, sortId, filterId, pageSize }) => {
  let count = 0;
  if (searchQuery.trim()) count += 1;
  if (sortId !== 'newest') count += 1;
  if (filterId !== 'all') count += 1;
  if (pageSize !== 10) count += 1;
  return count;
};

export function useDiscoverFilters({ isAuthenticated, requireAuth }) {
  const [filterId, setFilterId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortId, setSortId] = useState('newest');
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
  }, [sortId]);

  const onFilterChange = useCallback(
    (nextFilterId) => {
      if (nextFilterId === 'mine' && !isAuthenticated) {
        requireAuth(undefined, {
          message: 'Sign in to see tournaments you host.',
          returnTo: { screen: 'Home', params: { filterId: 'mine' } },
        });
        return;
      }
      setFilterId(nextFilterId);
    },
    [isAuthenticated, requireAuth]
  );

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
    () => countActiveFilters({ searchQuery, sortId, filterId, pageSize }),
    [filterId, pageSize, searchQuery, sortId]
  );

  return {
    filterId,
    setFilterId,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    sortId,
    setSortId,
    filtersExpanded,
    filtersPanelAnimation,
    page,
    setPage,
    pageSize,
    activeFilterCount,
    onFilterChange,
    onPageSizeChange,
    onPageChange,
    onToggleFiltersPanel,
  };
}
