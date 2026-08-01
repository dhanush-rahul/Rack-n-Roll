import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useDiscoverTournaments } from '../hooks/queries/useDiscoverTournaments';
import {
  submitTournamentRegistrationRequest,
  validateTournamentInviteCode,
} from '../services/tournamentService';
import { useTabScreenInsets } from '../hooks/useTabScreenInsets';
import { AppIcon } from '../components/ui/AppIcon';
import { PageColumn } from '../components/layout/PageColumn';
import { TabScreenScrollView } from '../components/layout/TabScreenScrollView';
import { useResponsiveLayout } from '../utils/responsive';
import { useDiscoverFilters } from '../hooks/useDiscoverFilters';
import { DiscoverHero } from '../components/discover/DiscoverHero';
import { WebInstallPrompt } from '../components/layout/WebInstallPrompt';
import { DiscoverFiltersPanel } from '../components/discover/DiscoverFiltersPanel';
import { DiscoverTournamentsHeader } from '../components/discover/DiscoverTournamentsHeader';
import { DiscoverTournamentCard } from '../components/discover/DiscoverTournamentCard';
import { PaginationBar } from '../components/discover/PaginationBar';
import {
  isDiscoverWalkthroughCompleted,
  WALKTHROUGH_FORCE_EVERY_VISIT,
} from '../utils/onboardingStore';
import { navigateToCreateFlow } from '../utils/navigateToCreateFlow';
import { DiscoverSkeleton } from '../components/ui/DiscoverSkeleton';

const HIGHLIGHT_BLINK_DURATION_MS = 6000;

function EmptyDiscoverState({ message, colors, title = 'Nothing here yet' }) {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: 'center',
        paddingVertical: 28,
        gap: 10,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name="pool" size={32} color={colors.primary} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20 }}>
        {message}
      </Text>
    </View>
  );
}

function DiscoverSectionBlock({ title, shownCount, children, colors }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{shownCount} shown</Text>
      </View>
      {children}
    </View>
  );
}

export function DiscoverScreen({ navigation, route }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const parentNavigation = navigation.getParent();
  const { requireAuth, authPromptProps } = useRequireAuth(parentNavigation || navigation);
  const queryClient = useQueryClient();
  const { scrollPaddingBottom } = useTabScreenInsets();
  const { isDesktopWeb } = useResponsiveLayout();

  const {
    filterId,
    setFilterId,
    searchQuery,
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
    setSearchQuery,
  } = useDiscoverFilters({ isAuthenticated, requireAuth });

  const [inviteCodeByTournamentId, setInviteCodeByTournamentId] = useState({});
  const [validationByTournamentId, setValidationByTournamentId] = useState({});
  const [registrationByTournamentId, setRegistrationByTournamentId] = useState({});
  const [expandedTournamentId, setExpandedTournamentId] = useState(null);
  const [ongoingPage, setOngoingPage] = useState(1);
  const expansionAnimationByIdRef = useRef({});
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    setInviteCodeByTournamentId({});
    setValidationByTournamentId({});
    setRegistrationByTournamentId({});
    setExpandedTournamentId(null);
  }, [isAuthenticated]);

  const {
    data: discoveryData,
    error: discoveryQueryError,
    isLoading: isLoadingDiscoveryAuth,
    isFetching: isFetchingDiscovery,
    refetch: refetchDiscovery,
  } = useDiscoverTournaments({
    page,
    pageSize,
    sort: sortId,
    q: debouncedSearchQuery,
    upcoming: true,
    registrationOpen: filterId === 'open',
    enabled: isAuthenticated,
  });

  const {
    data: guestUpcomingData,
    isLoading: isLoadingGuestUpcoming,
    isFetching: isFetchingGuestUpcoming,
    refetch: refetchGuestUpcoming,
  } = useDiscoverTournaments({
    page: 1,
    pageSize: 10,
    sort: 'startsSoon',
    upcoming: true,
    enabled: !isAuthenticated,
  });

  const {
    data: guestOngoingData,
    isLoading: isLoadingGuestOngoing,
    isFetching: isFetchingGuestOngoing,
    refetch: refetchGuestOngoing,
  } = useDiscoverTournaments({
    page: ongoingPage,
    pageSize: 5,
    sort: 'startsLatest',
    ongoing: true,
    enabled: !isAuthenticated,
  });

  const discoveryItems = isAuthenticated ? (discoveryData?.items ?? []) : (guestUpcomingData?.items ?? []);
  const discoveryMeta = isAuthenticated ? (discoveryData?.pagination ?? null) : (guestUpcomingData?.pagination ?? null);
  const guestOngoingItems = guestOngoingData?.items ?? [];
  const guestOngoingMeta = guestOngoingData?.pagination ?? null;
  const discoveryError = discoveryQueryError
    ? `${discoveryQueryError.code || 'ERROR'} - ${discoveryQueryError.message || 'Unable to load tournaments'}`
    : '';
  const isLoadingDiscovery = isAuthenticated ? isLoadingDiscoveryAuth : isLoadingGuestUpcoming;
  const isRefreshing = isAuthenticated
    ? isFetchingDiscovery && !isLoadingDiscoveryAuth
    : (isFetchingGuestUpcoming || isFetchingGuestOngoing) && !isLoadingGuestUpcoming;
  const highlightTournamentId = route.params?.highlightTournamentId || null;
  const highlightBlinkAnimation = useRef(new Animated.Value(0)).current;
  const highlightBlinkLoopRef = useRef(null);
  const skeletonPulse = useRef(new Animated.Value(0)).current;

  const getExpansionAnimation = useCallback((tournamentId) => {
    if (!expansionAnimationByIdRef.current[tournamentId]) {
      expansionAnimationByIdRef.current[tournamentId] = new Animated.Value(0);
    }
    return expansionAnimationByIdRef.current[tournamentId];
  }, []);

  const runExpansionAnimation = useCallback(
    (tournamentId, toValue) => {
      const animationValue = getExpansionAnimation(tournamentId);
      animationValue.stopAnimation();
      Animated.timing(animationValue, {
        toValue,
        duration: 360,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }).start();
    },
    [getExpansionAnimation]
  );

  useEffect(() => {
    if (!route.params?.filterId) return;
    setFilterId(route.params.filterId);
    navigation.setParams({ filterId: undefined });
  }, [navigation, route.params?.filterId, setFilterId]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(skeletonPulse, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [skeletonPulse]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.highlightTournamentId) {
        setPage(1);
        setFilterId('all');
      }
    }, [route.params?.highlightTournamentId, setPage, setFilterId])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const maybeOpenWalkthrough = async () => {
        if (!isAuthenticated || cancelled) {
          return;
        }

        if (WALKTHROUGH_FORCE_EVERY_VISIT) {
          parentNavigation?.replace('DiscoverWalkthrough');
          return;
        }

        const completed = await isDiscoverWalkthroughCompleted();
        if (!completed && !cancelled) {
          parentNavigation?.replace('DiscoverWalkthrough');
        }
      };

      maybeOpenWalkthrough();

      return () => {
        cancelled = true;
      };
    }, [isAuthenticated, parentNavigation])
  );

  const getRequestEnabled = useCallback(
    (item) => {
      if (!isAuthenticated) {
        return false;
      }

      const isHostTournament = String(item.hostUserId) === String(currentUser?.id);
      if (item.registrationStatus !== 'open') return false;
      if (isHostTournament) return true;
      if (item.registrationMode === 'public') return true;
      return validationByTournamentId[item.id]?.requestEnabled === true;
    },
    [currentUser?.id, isAuthenticated, validationByTournamentId]
  );

  useEffect(() => {
    if (!highlightTournamentId) return undefined;
    const highlightedItemExists = discoveryItems.some((item) => item.id === highlightTournamentId);
    if (!highlightedItemExists) return undefined;

    setExpandedTournamentId(highlightTournamentId);
    runExpansionAnimation(highlightTournamentId, 1);

    highlightBlinkAnimation.setValue(0);
    highlightBlinkLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(highlightBlinkAnimation, { toValue: 1, duration: 500, useNativeDriver: false }),
        Animated.timing(highlightBlinkAnimation, { toValue: 0, duration: 500, useNativeDriver: false }),
      ])
    );
    highlightBlinkLoopRef.current.start();

    const stopTimerId = setTimeout(() => {
      highlightBlinkLoopRef.current?.stop();
      highlightBlinkAnimation.setValue(0);
      navigation.setParams({ highlightTournamentId: undefined });
    }, HIGHLIGHT_BLINK_DURATION_MS);

    return () => {
      clearTimeout(stopTimerId);
      highlightBlinkLoopRef.current?.stop();
    };
  }, [discoveryItems, highlightBlinkAnimation, highlightTournamentId, navigation, runExpansionAnimation]);

  const onValidateInviteCode = useCallback(
    async (tournamentId) => {
      try {
        setValidationByTournamentId((prev) => ({
          ...prev,
          [tournamentId]: { ...(prev[tournamentId] || {}), isChecking: true, message: '' },
        }));
        const inviteCode = inviteCodeByTournamentId[tournamentId] || '';
        const response = await validateTournamentInviteCode(tournamentId, inviteCode);
        setValidationByTournamentId((prev) => ({
          ...prev,
          [tournamentId]: {
            ...(prev[tournamentId] || {}),
            isChecking: false,
            valid: response.valid,
            requestEnabled: response.requestEnabled,
            message:
              response.reason === 'INVITE_CODE_VALID'
                ? 'Invite code accepted — you can register now.'
                : response.reason === 'REGISTRATION_CLOSED'
                ? 'Registration is closed for this tournament.'
                : 'That invite code did not match.',
          },
        }));
      } catch (error) {
        setValidationByTournamentId((prev) => ({
          ...prev,
          [tournamentId]: {
            ...(prev[tournamentId] || {}),
            isChecking: false,
            valid: false,
            requestEnabled: false,
            message: `${error.code || 'ERROR'} - ${error.message || 'Unable to validate invite code'}`,
          },
        }));
      }
    },
    [inviteCodeByTournamentId]
  );

  const submitRegistrationRequest = useCallback(
    async (item) => {
      try {
        setRegistrationByTournamentId((prev) => ({
          ...prev,
          [item.id]: { ...(prev[item.id] || {}), isSubmitting: true, message: '', status: null },
        }));
        const inviteCode = inviteCodeByTournamentId[item.id] || '';
        const payload = item.registrationMode === 'inviteOnly' ? { inviteCode } : {};
        const response = await submitTournamentRegistrationRequest(item.id, payload);
        setRegistrationByTournamentId((prev) => ({
          ...prev,
          [item.id]: {
            ...(prev[item.id] || {}),
            isSubmitting: false,
            message: `Request sent — status: ${response.status}`,
            status: response.status,
          },
        }));
        await queryClient.invalidateQueries({ queryKey: ['discover'] });
        await queryClient.invalidateQueries({ queryKey: ['tournaments', 'my'] });
      } catch (error) {
        setRegistrationByTournamentId((prev) => ({
          ...prev,
          [item.id]: {
            ...(prev[item.id] || {}),
            isSubmitting: false,
            message: `${error.code || 'ERROR'} - ${error.message || 'Unable to submit registration request'}`,
            status: null,
          },
        }));
      }
    },
    [inviteCodeByTournamentId, queryClient]
  );

  const onRequestRegistration = useCallback(
    (item) => {
      requireAuth(() => submitRegistrationRequest(item), {
        message: 'Sign in to request a spot in this tournament.',
        returnTo: { screen: 'MainTabs', params: { screen: 'Discover', params: { highlightTournamentId: item.id } } },
      });
    },
    [requireAuth, submitRegistrationRequest]
  );

  const onToggleExpand = useCallback(
    (tournamentId) => {
      setExpandedTournamentId((previousId) => {
        if (previousId === tournamentId) {
          runExpansionAnimation(tournamentId, 0);
          return null;
        }
        if (previousId) runExpansionAnimation(previousId, 0);
        runExpansionAnimation(tournamentId, 1);
        return tournamentId;
      });
    },
    [runExpansionAnimation]
  );

  const onOpenTournamentDetail = useCallback(
    (item) => {
      requireAuth(
        () => {
          parentNavigation?.navigate('TournamentDetail', {
            tournamentId: item.id,
            tournamentName: item.name,
          });
        },
        {
          message: 'Sign in to open the host dashboard.',
          returnTo: { screen: 'MainTabs', params: { screen: 'Discover', params: { highlightTournamentId: item.id } } },
        }
      );
    },
    [parentNavigation, requireAuth]
  );

  const onOpenScoresheet = useCallback(
    (item) => {
      parentNavigation?.navigate('Scoresheet', {
        tournamentId: item.id,
        tournamentName: item.name,
      });
    },
    [parentNavigation]
  );

  const onCreateTournament = useCallback(() => {
    requireAuth(async () => {
      await navigateToCreateFlow(parentNavigation || navigation);
    }, {
      message: 'Sign in to host a tournament.',
      returnTo: { screen: 'MainTabs', params: { screen: 'CreateTab' } },
    });
  }, [navigation, parentNavigation, requireAuth]);

  const stats = useMemo(() => {
    const openCount = discoveryItems.filter((item) => item.registrationStatus === 'open').length;
    return { openCount, total: discoveryMeta?.total ?? discoveryItems.length };
  }, [discoveryItems, discoveryMeta?.total]);

  const totalCount = discoveryMeta?.total ?? discoveryItems.length;
  const totalPages = discoveryMeta?.totalPages ?? 1;
  const guestOngoingTotalPages = guestOngoingMeta?.totalPages ?? 1;

  const emptyUpcomingMessage = useMemo(() => {
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) {
      return `No tournaments match "${trimmedSearch}". Try another name or clear search.`;
    }
    if (filterId === 'open') {
      return 'No open registration events match your filters right now.';
    }
    return 'No upcoming tournaments.';
  }, [filterId, searchQuery]);

  const onRefreshDiscover = useCallback(() => {
    if (isAuthenticated) {
      refetchDiscovery();
      return;
    }
    refetchGuestUpcoming();
    refetchGuestOngoing();
  }, [isAuthenticated, refetchDiscovery, refetchGuestOngoing, refetchGuestUpcoming]);

  const renderTournamentCard = (item) => (
    <View key={item.id}>
      <DiscoverTournamentCard
        item={item}
        isExpanded={expandedTournamentId === item.id}
        isHighlighted={item.id === highlightTournamentId}
        isAuthenticated={isAuthenticated}
        isHostTournament={String(item.hostUserId) === String(currentUser?.id)}
        highlightBlinkAnimation={highlightBlinkAnimation}
        expansionAnimation={getExpansionAnimation(item.id)}
        inviteCode={inviteCodeByTournamentId[item.id] || ''}
        onInviteCodeChange={(value) => setInviteCodeByTournamentId((prev) => ({ ...prev, [item.id]: value }))}
        tournamentValidation={validationByTournamentId[item.id] || {}}
        registrationState={registrationByTournamentId[item.id] || {}}
        hasExistingRegistration={Boolean(
          isAuthenticated ? registrationByTournamentId[item.id]?.status || item.currentUserRegistrationStatus : null
        )}
        existingRegistrationStatus={
          isAuthenticated
            ? registrationByTournamentId[item.id]?.status || item.currentUserRegistrationStatus || null
            : null
        }
        requestEnabled={getRequestEnabled(item)}
        onToggleExpand={onToggleExpand}
        onOpenTournamentDetail={onOpenTournamentDetail}
        onOpenScoresheet={onOpenScoresheet}
        onValidateInviteCode={onValidateInviteCode}
        onRequestRegistration={onRequestRegistration}
      />
    </View>
  );

  return (
    <>
      <TabScreenScrollView
        ref={scrollViewRef}
        style={{ backgroundColor: isDesktopWeb ? colors.backgroundAlt : colors.background }}
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefreshDiscover} tintColor={colors.primary} />
        }
      >
        <PageColumn>
        <View style={{ marginBottom: 16 }}>
          <DiscoverHero total={totalCount} openCount={stats.openCount} myCount={0} onCreate={onCreateTournament} />
        </View>

        <WebInstallPrompt />

        {Boolean(discoveryError) && (
          <View
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.errorSurface,
              borderWidth: 1,
              borderColor: colors.errorBorder,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <AppIcon name="warning" size={18} color={colors.error} />
            <Text style={{ flex: 1, color: colors.error, fontSize: 13, lineHeight: 18 }}>{discoveryError}</Text>
          </View>
        )}

        {!isAuthenticated ? (
          <>
            <DiscoverSectionBlock title="Upcoming tournaments" shownCount={discoveryItems.length} colors={colors}>
              {isLoadingGuestUpcoming && discoveryItems.length === 0 ? (
                <DiscoverSkeleton pulse={skeletonPulse} />
              ) : discoveryItems.length === 0 ? (
                <EmptyDiscoverState message="No upcoming tournaments." colors={colors} title="No upcoming tournaments" />
              ) : (
                <View style={{ gap: 12 }}>{discoveryItems.map(renderTournamentCard)}</View>
              )}
            </DiscoverSectionBlock>

            <DiscoverSectionBlock title="Ongoing tournaments" shownCount={guestOngoingItems.length} colors={colors}>
              {isLoadingGuestOngoing && guestOngoingItems.length === 0 ? (
                <DiscoverSkeleton pulse={skeletonPulse} />
              ) : guestOngoingItems.length === 0 ? (
                <EmptyDiscoverState message="No ongoing tournaments right now." colors={colors} title="No ongoing tournaments" />
              ) : (
                <View style={{ gap: 12 }}>{guestOngoingItems.map(renderTournamentCard)}</View>
              )}
              <View style={{ marginTop: 16 }}>
                <PaginationBar page={ongoingPage} totalPages={guestOngoingTotalPages} onPageChange={setOngoingPage} />
              </View>
            </DiscoverSectionBlock>
          </>
        ) : (
          <View>
            <DiscoverTournamentsHeader
              shownCount={discoveryItems.length}
              activeFilterCount={activeFilterCount}
              filtersExpanded={filtersExpanded}
              onToggleFilters={onToggleFiltersPanel}
            />
            <DiscoverFiltersPanel
              expanded={filtersExpanded}
              panelAnimation={filtersPanelAnimation}
              activeFilterCount={activeFilterCount}
              searchQuery={searchQuery}
              sortId={sortId}
              filterId={filterId}
              pageSize={pageSize}
              isRefreshing={isRefreshing || isLoadingDiscovery}
              onRefresh={() => refetchDiscovery()}
              onSearchQueryChange={setSearchQuery}
              onClearSearch={() => setSearchQuery('')}
              onSortChange={setSortId}
              onFilterChange={onFilterChange}
              onPageSizeChange={onPageSizeChange}
            />
            {isLoadingDiscovery && discoveryItems.length === 0 ? (
              <DiscoverSkeleton pulse={skeletonPulse} />
            ) : discoveryItems.length === 0 ? (
              <EmptyDiscoverState message={emptyUpcomingMessage} colors={colors} title="No upcoming tournaments" />
            ) : (
              <View style={{ gap: 12 }}>{discoveryItems.map(renderTournamentCard)}</View>
            )}
          </View>
        )}

        {isAuthenticated ? (
          <View style={{ marginTop: 16 }}>
            <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} />
          </View>
        ) : null}

        {isLoadingDiscovery && discoveryItems.length > 0 && isAuthenticated && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 8 }}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Updating…</Text>
          </View>
        )}
        </PageColumn>
      </TabScreenScrollView>
      <AuthPromptModal {...authPromptProps} />
    </>
  );
}
