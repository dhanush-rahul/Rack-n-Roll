import React, { useCallback, useMemo } from 'react';

import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useQueryClient } from '@tanstack/react-query';

import { ScaledText as Text } from '../components/ui/ScaledText';

import { useAuth } from '../context/AuthContext';

import { useTheme } from '../context/ThemeContext';

import { AuthPromptModal } from '../components/AuthPromptModal';

import { useRequireAuth } from '../hooks/useRequireAuth';

import { useMyTournaments } from '../hooks/queries/useMyTournaments';

import { queryKeys } from '../hooks/queries/queryKeys';

import { useTabScreenInsets } from '../hooks/useTabScreenInsets';

import { AppIcon } from '../components/ui/AppIcon';

import { PageColumn } from '../components/layout/PageColumn';
import { useResponsiveLayout } from '../utils/responsive';

import { DiscoverFiltersPanel } from '../components/discover/DiscoverFiltersPanel';

import { DiscoverTournamentsHeader } from '../components/discover/DiscoverTournamentsHeader';

import { PaginationBar } from '../components/discover/PaginationBar';

import { MyEventsHero } from '../components/myEvents/MyEventsHero';

import {

  MY_EVENTS_FILTER_OPTIONS,

  MY_EVENTS_SORT_OPTIONS,

  useMyEventsFilters,

} from '../hooks/useMyEventsFilters';

import { fetchHostTournamentDetail, fetchTournamentScoresheet } from '../services/tournamentService';

import { HOST_DETAIL_STALE_TIME_MS, SCORESHEET_STALE_TIME_MS } from '../config/queryClient';



const formatStartsAt = (value) => {

  if (!value) return 'Start date TBD';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Start date TBD';

  return date.toLocaleString(undefined, {

    weekday: 'short',

    month: 'short',

    day: 'numeric',

    hour: 'numeric',

    minute: '2-digit',

  });

};



const formatLastActivity = (value) => {

  if (!value) return 'No recent match activity';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'No recent match activity';

  return `Last activity ${date.toLocaleString(undefined, {

    month: 'short',

    day: 'numeric',

    hour: 'numeric',

    minute: '2-digit',

  })}`;

};



function RoleBadge({ label, tone, colors }) {

  const palette =

    tone === 'host'

      ? { bg: colors.badgeHostBg, text: colors.badgeHostText }

      : tone === 'pending'

        ? { bg: colors.statusWarningBg, text: colors.statusWarningText }

        : { bg: colors.statusInfoBg, text: colors.statusInfoText };



  return (

    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: palette.bg }}>

      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.text }}>{label}</Text>

    </View>

  );

}



function TournamentRow({ item, colors, onPress }) {

  const isHost = (item.roles || []).includes('host');

  const isPending = item.currentUserRegistrationStatus === 'underReview';



  return (

    <Pressable

      onPress={() => onPress(item)}

      style={({ pressed }) => ({

        opacity: pressed ? 0.92 : 1,

        padding: 14,

        borderTopWidth: 1,

        borderTopColor: colors.borderLight,

        gap: 8,

      })}

    >

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>

        <View style={{ flex: 1, gap: 4 }}>

          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{item.name}</Text>

          <Text style={{ fontSize: 13, color: colors.textMuted }}>{formatStartsAt(item.startsAt)}</Text>

          <Text style={{ fontSize: 12, color: colors.textMuted }}>{formatLastActivity(item.lastMatchActivityAt)}</Text>

        </View>

        <AppIcon name="chevronRight" size={20} color={colors.textMuted} />

      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>

        {isHost ? <RoleBadge label="Hosting" tone="host" colors={colors} /> : null}

        {isPending ? <RoleBadge label="Pending approval" tone="pending" colors={colors} /> : null}

        {!isHost && !isPending ? <RoleBadge label="Playing" tone="player" colors={colors} /> : null}

      </View>

    </Pressable>

  );

}



export function MyTournamentsScreen({ navigation }) {

  const { isAuthenticated, currentUser } = useAuth();

  const { colors } = useTheme();

  const queryClient = useQueryClient();

  const parentNavigation = navigation.getParent();

  const { requireAuth, authPromptProps } = useRequireAuth(parentNavigation || navigation);

  const { scrollPaddingBottom } = useTabScreenInsets();

  const { isDesktopWeb } = useResponsiveLayout();



  const {

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

  } = useMyEventsFilters();



  const { data, isLoading, isFetching, error, refetch } = useMyTournaments({

    page,

    pageSize,

    sort: sortId,

    q: debouncedSearchQuery,

    filter: filterParam,

    enabled: isAuthenticated,

  });



  const items = data?.items ?? [];

  const pagination = data?.pagination ?? null;

  const eventStats = data?.stats ?? { total: 0, hostingCount: 0, playingCount: 0 };

  const totalPages = pagination?.totalPages ?? 1;



  const onOpenTournament = useCallback(

    (item) => {

      const isHost = String(item.hostUserId) === String(currentUser?.id);

      if (isHost) {

        queryClient.prefetchQuery({

          queryKey: queryKeys.hostDetail(item.id),

          queryFn: () => fetchHostTournamentDetail(item.id),

          staleTime: HOST_DETAIL_STALE_TIME_MS,

        });

        parentNavigation?.navigate('TournamentDetail', {

          tournamentId: item.id,

          tournamentName: item.name,

        });

        return;

      }



      queryClient.prefetchQuery({

        queryKey: queryKeys.scoresheet(item.id, { meta: true }),

        queryFn: () => fetchTournamentScoresheet(item.id, { page: 1, pageSize: 1 }),

        staleTime: SCORESHEET_STALE_TIME_MS,

      });

      parentNavigation?.navigate('Scoresheet', {

        tournamentId: item.id,

        tournamentName: item.name,

      });

    },

    [currentUser?.id, parentNavigation, queryClient]

  );



  if (!isAuthenticated) {

    return (

      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>

        <AppIcon name="trophy" size={48} color={colors.primary} />

        <Text style={{ marginTop: 16, fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' }}>

          My Events

        </Text>

        <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center' }}>

          Sign in to see events you host, play in, or have registered for.

        </Text>

        <Pressable

          onPress={() =>

            requireAuth(() => {}, {

              message: 'Sign in to view your events.',

              returnTo: { screen: 'MainTabs', params: { screen: 'MyTournaments' } },

            })

          }

          style={{

            marginTop: 20,

            paddingHorizontal: 20,

            paddingVertical: 13,

            borderRadius: 12,

            backgroundColor: colors.primary,

          }}

        >

          <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>Sign in</Text>

        </Pressable>

        <AuthPromptModal {...authPromptProps} />

      </View>

    );

  }



  const errorMessage = error

    ? `${error.code || 'ERROR'} - ${error.message || 'Unable to load your events'}`

    : '';



  return (

    <>

      <ScrollView

        style={{ flex: 1, backgroundColor: isDesktopWeb ? colors.backgroundAlt : colors.background }}

        contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}

        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />}

      >

        <PageColumn>

        <MyEventsHero

          total={eventStats.total}

          hostingCount={eventStats.hostingCount}

          playingCount={eventStats.playingCount}

        />



        <DiscoverFiltersPanel

          expanded={filtersExpanded}

          panelAnimation={filtersPanelAnimation}

          activeFilterCount={activeFilterCount}

          searchQuery={searchQuery}

          sortId={sortId}

          filterIds={filterIds}

          filterMultiSelect

          pageSize={pageSize}

          isRefreshing={isFetching && !isLoading}

          onRefresh={() => refetch()}

          onSearchQueryChange={setSearchQuery}

          onClearSearch={() => setSearchQuery('')}

          onSortChange={setSortId}

          onFilterToggle={onFilterToggle}

          onPageSizeChange={onPageSizeChange}

          filterOptions={MY_EVENTS_FILTER_OPTIONS}

          sortOptions={MY_EVENTS_SORT_OPTIONS}

          searchPlaceholder="Search by event name"

          panelTitle="Search & filters"

          filterSectionLabel="SHOW"

        />



        <DiscoverTournamentsHeader

          shownCount={items.length}

          activeFilterCount={activeFilterCount}

          filtersExpanded={filtersExpanded}

          onToggleFilters={onToggleFiltersPanel}

        />



        <View

          style={{

            borderRadius: 16,

            backgroundColor: colors.surface,

            borderWidth: 1,

            borderColor: colors.borderLight,

            overflow: 'hidden',

          }}

        >

          {isLoading ? (

            <View style={{ padding: 24, alignItems: 'center' }}>

              <ActivityIndicator color={colors.primary} />

            </View>

          ) : errorMessage ? (

            <View style={{ padding: 16 }}>

              <Text style={{ color: colors.error, fontSize: 13, lineHeight: 18 }}>{errorMessage}</Text>

            </View>

          ) : items.length === 0 ? (

            <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>

              <AppIcon name="trophyOutline" size={36} color={colors.textMuted} />

              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>

                {eventStats.total === 0

                  ? 'You are not in any events yet. Browse Discover to register or create your own event.'

                  : 'No events match your current filters.'}

              </Text>

            </View>

          ) : (

            items.map((item) => (

              <TournamentRow key={item.id} item={item} colors={colors} onPress={onOpenTournament} />

            ))

          )}

        </View>



        <View style={{ marginTop: 16 }}>

          <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} />

        </View>



        {isFetching && !isLoading && items.length > 0 ? (

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 8 }}>

            <ActivityIndicator color={colors.primary} size="small" />

            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>Updating…</Text>

          </View>

        ) : null}

        </PageColumn>

      </ScrollView>

      <AuthPromptModal {...authPromptProps} />

    </>

  );

}

