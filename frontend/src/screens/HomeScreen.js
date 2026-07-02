import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useAuth } from '../context/AuthContext';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useDiscoverTournaments } from '../hooks/queries/useDiscoverTournaments';
import { useMyRegisteredTournaments } from '../hooks/queries/useMyRegisteredTournaments';
import {
  submitTournamentRegistrationRequest,
  validateTournamentInviteCode,
} from '../services/tournamentService';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { AppIcon } from '../components/ui/AppIcon';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { useDiscoverFilters } from '../hooks/useDiscoverFilters';
import { useHomeBackHandler } from '../hooks/useHomeBackHandler';
import { DiscoverHero } from '../components/discover/DiscoverHero';
import { DiscoverRegisteredSection } from '../components/discover/DiscoverRegisteredSection';
import { DiscoverFiltersPanel } from '../components/discover/DiscoverFiltersPanel';
import { DiscoverTournamentsHeader } from '../components/discover/DiscoverTournamentsHeader';
import { DiscoverTournamentCard } from '../components/discover/DiscoverTournamentCard';
import { PaginationBar } from '../components/discover/PaginationBar';
import {
  isCreateTournamentWalkthroughCompleted,
  isDiscoverWalkthroughCompleted,
  WALKTHROUGH_FORCE_EVERY_VISIT,
} from '../utils/onboardingStore';

const HIGHLIGHT_BLINK_DURATION_MS = 6000;

function SkeletonCard({ pulse }) {
  return (
    <Animated.View
      style={{
        height: 132,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.75] }),
      }}
    />
  );
}

function LoadingPlaceholder({ pulse }) {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map((key) => (
        <SkeletonCard key={key} pulse={pulse} />
      ))}
    </View>
  );
}

function EmptyDiscoverState({ onCreate, filterId, searchQuery }) {
  const trimmedSearch = searchQuery.trim();

  const message = trimmedSearch
    ? `No tournaments match "${trimmedSearch}". Try another name or clear search.`
    : filterId === 'mine'
      ? "You haven't hosted any tournaments on this page yet."
      : filterId === 'open'
      ? 'No open registration events match your filters right now.'
      : 'Be the first to host — players are waiting for events like yours.';

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: tournamentColors.white,
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
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
          backgroundColor: '#eff6ff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name="pool" size={32} color={tournamentColors.primary} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: tournamentColors.text, textAlign: 'center' }}>
        Nothing here yet
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: tournamentColors.textMuted, textAlign: 'center' }}>
        {message}
      </Text>
      {!trimmedSearch && filterId !== 'open' && (
        <Pressable
          onPress={onCreate}
          style={{
            marginTop: 6,
            paddingHorizontal: 20,
            paddingVertical: 13,
            borderRadius: 12,
            backgroundColor: tournamentColors.primary,
          }}
        >
          <Text style={{ color: tournamentColors.white, fontWeight: '800' }}>Create tournament</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HomeScreen({ navigation, route }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { requireAuth, authPromptProps } = useRequireAuth(navigation);
  const { exitConfirmVisible, confirmExit, cancelExit } = useHomeBackHandler();
  const queryClient = useQueryClient();
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding } = useResponsiveLayout();

  const {
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
  } = useDiscoverFilters({ isAuthenticated, requireAuth });

  const [inviteCodeByTournamentId, setInviteCodeByTournamentId] = useState({});
  const [validationByTournamentId, setValidationByTournamentId] = useState({});
  const [registrationByTournamentId, setRegistrationByTournamentId] = useState({});
  const [expandedTournamentId, setExpandedTournamentId] = useState(null);
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
    isLoading: isLoadingDiscovery,
    isFetching: isFetchingDiscovery,
    refetch: refetchDiscovery,
  } = useDiscoverTournaments({
    page,
    pageSize,
    sort: sortId,
    q: debouncedSearchQuery,
  });

  const {
    data: registeredItems = [],
    error: registeredQueryError,
    isLoading: isLoadingRegistered,
    isFetching: isFetchingRegistered,
    refetch: refetchRegistered,
  } = useMyRegisteredTournaments({ enabled: isAuthenticated });

  const discoveryItems = discoveryData?.items ?? [];
  const discoveryMeta = discoveryData?.pagination ?? null;
  const discoveryError = discoveryQueryError
    ? `${discoveryQueryError.code || 'ERROR'} - ${discoveryQueryError.message || 'Unable to load tournaments'}`
    : '';
  const registeredError = registeredQueryError
    ? `${registeredQueryError.code || 'ERROR'} - ${registeredQueryError.message || 'Unable to load your registrations'}`
    : '';
  const isRefreshing =
    (isFetchingDiscovery && !isLoadingDiscovery) || (isAuthenticated && isFetchingRegistered && !isLoadingRegistered);
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
          navigation.replace('DiscoverWalkthrough');
          return;
        }

        const completed = await isDiscoverWalkthroughCompleted();
        if (!completed && !cancelled) {
          navigation.replace('DiscoverWalkthrough');
        }
      };

      maybeOpenWalkthrough();

      return () => {
        cancelled = true;
      };
    }, [isAuthenticated, navigation])
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
        await queryClient.invalidateQueries({ queryKey: ['discover', 'registered'] });
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
        returnTo: { screen: 'Home', params: { highlightTournamentId: item.id } },
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
          navigation.navigate('TournamentDetail', {
            tournamentId: item.id,
            tournamentName: item.name,
          });
        },
        {
          message: 'Sign in to open the host dashboard.',
          returnTo: { screen: 'Home', params: { highlightTournamentId: item.id } },
        }
      );
    },
    [navigation, requireAuth]
  );

  const onOpenScoresheet = useCallback(
    (item) => {
      navigation.navigate('Scoresheet', {
        tournamentId: item.id,
        tournamentName: item.name,
      });
    },
    [navigation]
  );

  const onCreateTournament = useCallback(() => {
    requireAuth(async () => {
      if (WALKTHROUGH_FORCE_EVERY_VISIT) {
        navigation.navigate('CreateTournamentWalkthrough');
        return;
      }

      const completed = await isCreateTournamentWalkthroughCompleted();
      navigation.navigate(completed ? 'CreateTournament' : 'CreateTournamentWalkthrough');
    }, {
      message: 'Sign in to host a tournament.',
      returnTo: { screen: 'Home' },
    });
  }, [navigation, requireAuth]);

  const stats = useMemo(() => {
    const openCount = discoveryItems.filter((item) => item.registrationStatus === 'open').length;
    const myCount = discoveryItems.filter(
      (item) => String(item.hostUserId) === String(currentUser?.id)
    ).length;
    return { openCount, myCount };
  }, [currentUser?.id, discoveryItems]);

  const filteredItems = useMemo(() => {
    if (filterId === 'open') return discoveryItems.filter((item) => item.registrationStatus === 'open');
    if (filterId === 'mine') return discoveryItems.filter((item) => String(item.hostUserId) === String(currentUser?.id));
    return discoveryItems;
  }, [currentUser?.id, discoveryItems, filterId]);

  const totalCount = discoveryMeta?.total ?? discoveryItems.length;
  const totalPages = discoveryMeta?.totalPages ?? 1;

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={tournamentUi.screen}
        contentContainerStyle={[
          { padding: horizontalPadding, paddingBottom: scrollPaddingBottom },
          centeredContentStyle(contentMaxWidth),
        ]}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              refetchDiscovery();
              if (isAuthenticated) {
                refetchRegistered();
              }
            }}
            tintColor={tournamentColors.primary}
          />
        }
      >
        <View style={{ marginBottom: 16 }}>
          <DiscoverHero
            total={totalCount}
            openCount={stats.openCount}
            myCount={stats.myCount}
            onCreate={onCreateTournament}
          />
        </View>

        {isAuthenticated ? (
          <View style={{ marginBottom: 16 }}>
            <DiscoverRegisteredSection
              items={registeredItems}
              isLoading={isLoadingRegistered}
              errorMessage={registeredError}
              onOpenScoresheet={onOpenScoresheet}
            />
          </View>
        ) : null}

        {Boolean(discoveryError) && (
          <View
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <AppIcon name="warning" size={18} color={tournamentColors.error} />
            <Text style={{ flex: 1, color: tournamentColors.error, fontSize: 13, lineHeight: 18 }}>{discoveryError}</Text>
          </View>
        )}

        <View>
          <DiscoverTournamentsHeader
            shownCount={filteredItems.length}
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
            <LoadingPlaceholder pulse={skeletonPulse} />
          ) : filteredItems.length === 0 ? (
            <EmptyDiscoverState
              onCreate={onCreateTournament}
              filterId={filterId}
              searchQuery={searchQuery}
            />
          ) : (
            <View style={{ gap: 12 }}>
              {filteredItems.map((item) => (
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
                    onInviteCodeChange={(value) =>
                      setInviteCodeByTournamentId((prev) => ({ ...prev, [item.id]: value }))
                    }
                    tournamentValidation={validationByTournamentId[item.id] || {}}
                    registrationState={registrationByTournamentId[item.id] || {}}
                    hasExistingRegistration={Boolean(
                      isAuthenticated
                        ? registrationByTournamentId[item.id]?.status || item.currentUserRegistrationStatus
                        : null
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
              ))}
            </View>
          )}
        </View>

        <View style={{ marginTop: 16 }}>
          <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </View>

        {isLoadingDiscovery && discoveryItems.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 12,
              marginTop: 8,
            }}
          >
            <ActivityIndicator color={tournamentColors.primary} size="small" />
            <Text style={{ color: tournamentColors.textMuted, fontSize: 13, fontWeight: '600' }}>Updating…</Text>
          </View>
        )}
      </ScrollView>
      <AuthPromptModal {...authPromptProps} />
      <ConfirmModal
        visible={exitConfirmVisible}
        title="Exit Rack-N-Roll?"
        message="Are you sure you want to close the app?"
        confirmLabel="Exit"
        cancelLabel="Stay"
        onConfirm={confirmExit}
        onCancel={cancelExit}
        confirmVariant="danger"
        icon="warning"
      />
    </>
  );
}
