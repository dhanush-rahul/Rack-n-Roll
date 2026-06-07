import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/tournament/TournamentChrome';
import { ConfirmModal } from '../components/ConfirmModal';
import { EndGameDropdown } from '../components/liveMatch/EndGameDropdown';
import { LiveMatchScoringAccess } from '../components/liveMatch/LiveMatchScoringAccess';
import { CollapsibleTurnLog, CompletedGamesStrip } from '../components/liveMatch/LiveMatchTurnTimeline';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import {
  advanceLiveMatchTurn,
  cancelLiveMatchTakeover,
  declineLiveMatchTakeover,
  endLiveSeriesGame,
  fetchLiveMatchState,
  forceTakeoverLiveMatchScoring,
  handoffLiveMatchScoring,
  normalizeLiveMatchSession,
  requestLiveMatchTakeover,
  startLiveMatchSession,
} from '../services/tournamentService';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';

function PlayerSpotlight({
  player,
  isActive,
  seriesWins,
  visits,
  showLegWonFooter,
  currentInning,
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: isActive ? '#38bdf8' : 'rgba(226, 232, 240, 0.9)',
        backgroundColor: isActive ? 'rgba(15, 23, 42, 0.92)' : 'rgba(248, 250, 252, 0.98)',
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 1.1,
          color: isActive ? '#7dd3fc' : '#94a3b8',
        }}
      >
        {isActive ? 'AT THE TABLE' : 'WAITING'}
      </Text>
      <Text
        style={{
          marginTop: 8,
          fontSize: 17,
          fontWeight: '800',
          color: isActive ? '#f8fafc' : tournamentColors.text,
        }}
        numberOfLines={2}
      >
        {player?.displayName || 'Player'}
      </Text>
      <Text style={{ marginTop: 6, fontSize: 22, fontWeight: '800', color: isActive ? '#38bdf8' : tournamentColors.primary }}>
        {seriesWins}
      </Text>
      <Text style={{ fontSize: 11, color: isActive ? '#94a3b8' : tournamentColors.textMuted }}>series wins</Text>
      <View style={{ marginTop: 10, gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#cbd5e1' : tournamentColors.textMuted }}>
          Inning {currentInning} · {visits} {visits === 1 ? 'visit' : 'visits'}
        </Text>
        {showLegWonFooter && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>Won this leg</Text>
        )}
      </View>
    </View>
  );
}

export function LiveMatchSessionScreen({ route, navigation }) {
  const tournamentId = route?.params?.tournamentId;
  const gameId = route?.params?.gameId;
  const shouldAutoStart = route?.params?.autoStart !== false;
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [didAttemptAutoStart, setDidAttemptAutoStart] = useState(false);
  const [selectedEndReason, setSelectedEndReason] = useState(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState(null);
  const [legWinnerPlayerId, setLegWinnerPlayerId] = useState(null);
  const [legWonConfirmVisible, setLegWonConfirmVisible] = useState(false);
  const [confirmRequestTakeoverVisible, setConfirmRequestTakeoverVisible] = useState(false);
  const [confirmHandOffVisible, setConfirmHandOffVisible] = useState(false);
  const [confirmDeclineTakeoverVisible, setConfirmDeclineTakeoverVisible] = useState(false);
  const [confirmForceTakeoverVisible, setConfirmForceTakeoverVisible] = useState(false);
  const { errorMessage, showError, clearError } = useScreenFeedback({ successAutoClearMs: 0 });

  const loadSession = useCallback(async () => {
    try {
      clearError();
      const data = await fetchLiveMatchState(tournamentId, gameId);
      setSession(normalizeLiveMatchSession(data));
    } catch (error) {
      showError(formatApiError(error, 'Unable to load match session'));
    } finally {
      setIsLoading(false);
    }
  }, [clearError, gameId, showError, tournamentId]);

  useEffect(() => {
    setIsLoading(true);
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!session || session.status !== 'inProgress' || !session.canEdit) {
      return undefined;
    }

    const shouldPoll =
      Boolean(session.takeoverRequest) ||
      session.canClaimScoring ||
      session.canRequestTakeover ||
      session.canCancelTakeoverRequest ||
      session.canHandOffScoring ||
      !session.canMarkSession;

    if (!shouldPoll) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadSession();
    }, 4000);
    return () => clearInterval(intervalId);
  }, [loadSession, session]);

  const runAction = async (action) => {
    try {
      setIsBusy(true);
      clearError();
      const data = await action();
      setSession(normalizeLiveMatchSession(data));
    } catch (error) {
      showError(formatApiError(error, 'Action failed'));
    } finally {
      setIsBusy(false);
    }
  };

  const onStartOrResume = () =>
    runAction(() => startLiveMatchSession(tournamentId, gameId));

  useEffect(() => {
    if (!shouldAutoStart || didAttemptAutoStart || isLoading || isBusy || !session?.canEdit) {
      return;
    }

    if (session.status !== 'scheduled') {
      return;
    }

    setDidAttemptAutoStart(true);

    (async () => {
      try {
        setIsBusy(true);
        clearError();
        const data = await startLiveMatchSession(tournamentId, gameId);
        setSession(normalizeLiveMatchSession(data));
      } catch (error) {
        showError(formatApiError(error, 'Unable to start live scoring'));
      } finally {
        setIsBusy(false);
      }
    })();
  }, [
    clearError,
    didAttemptAutoStart,
    gameId,
    isBusy,
    isLoading,
    session?.canEdit,
    session?.sessionController,
    session?.status,
    shouldAutoStart,
    showError,
    tournamentId,
  ]);

  const onAdvanceTurn = (payload) =>
    runAction(() => advanceLiveMatchTurn(tournamentId, gameId, payload));

  const onPassTable = async () => {
    try {
      setIsBusy(true);
      clearError();
      let activeSession = session;
      if (!activeSession?.canMarkSession && !activeSession?.isSessionController) {
        activeSession = normalizeLiveMatchSession(await startLiveMatchSession(tournamentId, gameId));
        setSession(activeSession);
      }
      if (!activeSession?.canMarkSession && !activeSession?.isSessionController) {
        showError('Start or resume scoring before passing the table.');
        return;
      }
      const legRequiredNow =
        activeSession?.legRequiredForActiveGame ?? Number(activeSession?.activeGameNumber || 1) === 1;
      const legSatisfiedNow =
        activeSession?.legSatisfied ??
        (!legRequiredNow ||
          Boolean(activeSession?.activeGame?.legWinnerPlayerId || activeSession?.activeLegWinnerPlayerId));
      if (!legSatisfiedNow) {
        showError('Mark the leg winner before passing the table.');
        return;
      }
      if (!activeSession?.canMarkVisit && !activeSession?.canMarkSession && !activeSession?.isSessionController) {
        showError('Start or resume scoring before passing the table.');
        return;
      }
      const nextId =
        String(activeSession.currentTurnPlayerId) === String(activeSession.playerA?.id)
          ? activeSession.playerB?.id
          : activeSession.playerA?.id;
      const updated = await advanceLiveMatchTurn(tournamentId, gameId, { nextPlayerId: nextId });
      setSession(normalizeLiveMatchSession(updated));
    } catch (error) {
      showError(formatApiError(error, 'Unable to pass the table'));
    } finally {
      setIsBusy(false);
    }
  };

  const onConfirmEndGame = async () => {
    if (!selectedWinnerId || !selectedEndReason) {
      showError('Select the winner and end-game reason.');
      return;
    }

    try {
      setIsBusy(true);
      clearError();
      const result = await endLiveSeriesGame(tournamentId, gameId, {
        winnerPlayerId: selectedWinnerId,
        endReason: selectedEndReason,
      });
      setSession(normalizeLiveMatchSession(result));
      setSelectedEndReason(null);
      setSelectedWinnerId(null);
      if (result?.seriesComplete) {
        navigation.goBack();
      }
    } catch (error) {
      showError(formatApiError(error, 'Unable to end game'));
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading && !session) {
    return (
      <View style={[tournamentUi.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: tournamentColors.textMuted }}>Loading match…</Text>
      </View>
    );
  }

  const isInProgress =
    session?.status === 'inProgress' ||
    Boolean(session?.canMarkSession || session?.isSessionController || session?.sessionController);
  const canMark = Boolean(session?.canMarkSession || session?.isSessionController);
  const currentTurnId = session?.currentTurnPlayerId;
  const playerAId = session?.playerA?.id;
  const playerBId = session?.playerB?.id;
  const legWinnerFromTurn = (session?.activeGame?.turns || []).find((turn) => turn.legWinnerPlayerId)?.legWinnerPlayerId;
  const legWinnerId =
    session?.activeGame?.legWinnerPlayerId ||
    session?.activeLegWinnerPlayerId ||
    legWinnerFromTurn ||
    null;
  const legRequired = session?.legRequiredForActiveGame ?? Number(session?.activeGameNumber || 1) === 1;
  const legSatisfied = session?.legSatisfied ?? (!legRequired || Boolean(legWinnerId));
  const hasLeg = Boolean(legWinnerId);
  const innings = session?.activeGame?.innings;
  const isActiveScorer = Boolean(session?.canMarkSession || session?.isSessionController);
  const showLegWonControls = Boolean(
    session?.canEdit && isInProgress && legRequired && !hasLeg && isActiveScorer && session?.canMarkLegWon !== false
  );
  const showPassTable = Boolean(
    session?.canEdit && isInProgress && legSatisfied && (session?.canMarkVisit || isActiveScorer)
  );
  const breakerPlayerId = session?.previousGameBreakerPlayerId || null;
  const breakerName =
    String(breakerPlayerId) === String(playerAId)
      ? session?.playerA?.displayName
      : String(breakerPlayerId) === String(playerBId)
        ? session?.playerB?.displayName
        : null;
  const activePlayer =
    String(currentTurnId) === String(playerAId) ? session?.playerA : session?.playerB;
  const nextPlayer =
    String(currentTurnId) === String(playerAId) ? session?.playerB : session?.playerA;
  const nextPlayerId =
    String(currentTurnId) === String(playerAId) ? playerBId : playerAId;
  const legWinnerName =
    String(legWinnerId) === String(playerAId)
      ? session?.playerA?.displayName
      : String(legWinnerId) === String(playerBId)
        ? session?.playerB?.displayName
        : null;

  return (
    <View style={[tournamentUi.screen, { backgroundColor: '#f1f5f9' }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 16 }}>
        <View
          style={{
            padding: 18,
            borderRadius: 18,
            backgroundColor: '#0f172a',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -30,
              right: -20,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: 'rgba(56, 189, 248, 0.25)',
            }}
          />
          <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#7dd3fc' }}>
            LIVE MATCH
          </Text>
          <Text style={{ marginTop: 6, fontSize: 26, fontWeight: '800', color: '#f8fafc' }}>
            Best of {session?.bestOf || 1}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 15, color: '#94a3b8' }}>
            Game {session?.activeGameNumber || 1} of {session?.bestOf || 1} · Series {session?.playerASeriesWins || 0}–
            {session?.playerBSeriesWins || 0}
            {innings ? ` · Inning ${innings.currentInning}` : ''}
          </Text>
          {legRequired && !hasLeg && (
            <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '700', color: '#fde68a' }}>
              Mark leg won to decide who breaks game 1
            </Text>
          )}
          {legRequired && hasLeg && legWinnerName && (
            <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '700', color: '#86efac' }}>
              Leg: {legWinnerName} — pass the table to track visits
            </Text>
          )}
          {!legRequired && breakerName && (
            <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '700', color: '#86efac' }}>
              {breakerName} breaks (won previous game)
            </Text>
          )}
        </View>

        {isInProgress && session?.canEdit && (
          <LiveMatchScoringAccess
            session={session}
            isBusy={isBusy}
            onRequestTakeover={() => setConfirmRequestTakeoverVisible(true)}
            onHandOff={() => setConfirmHandOffVisible(true)}
            onDecline={() => setConfirmDeclineTakeoverVisible(true)}
            onCancelRequest={() => runAction(() => cancelLiveMatchTakeover(tournamentId, gameId))}
            onForceTakeover={() => setConfirmForceTakeoverVisible(true)}
            onResumeScoring={onStartOrResume}
          />
        )}

        {session?.scoringReleasedDueToInactivity && (
          <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
            Scoring was released after 5 minutes of inactivity. Anyone with proctor access can resume.
          </Text>
        )}

        {!isInProgress && session?.canEdit && session?.status !== 'completed' && (
          <ActionButton label={isBusy ? 'Starting…' : 'Start game'} onPress={onStartOrResume} disabled={isBusy} fullWidth />
        )}

        {isInProgress && (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PlayerSpotlight
                player={session.playerA}
                isActive={String(currentTurnId) === String(playerAId)}
                seriesWins={session.playerASeriesWins || 0}
                visits={innings?.visitsA || 0}
                showLegWonFooter={legRequired && Boolean(legWinnerId && String(legWinnerId) === String(playerAId))}
                currentInning={innings?.currentInning || 1}
              />
              <PlayerSpotlight
                player={session.playerB}
                isActive={String(currentTurnId) === String(playerBId)}
                seriesWins={session.playerBSeriesWins || 0}
                visits={innings?.visitsB || 0}
                showLegWonFooter={legRequired && Boolean(legWinnerId && String(legWinnerId) === String(playerBId))}
                currentInning={innings?.currentInning || 1}
              />
            </View>

            {showPassTable && (
              <View
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: tournamentColors.white,
                  borderWidth: 1,
                  borderColor: tournamentColors.borderLight,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: tournamentColors.text }}>
                  Player turn
                </Text>
                <Text style={{ fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
                  At the table: {activePlayer?.displayName || 'Player'}. Pass the table when their visit ends and
                  {` ${nextPlayer?.displayName || 'the other player'} `}
                  is up. Both visits = one inning.
                </Text>
                <ActionButton
                  label={
                    isBusy
                      ? 'Working…'
                      : isActiveScorer
                        ? `Pass the table → ${nextPlayer?.displayName || 'other player'}`
                        : 'Start scoring to pass the table'
                  }
                  onPress={onPassTable}
                  disabled={isBusy}
                  fullWidth
                />
              </View>
            )}

            {showLegWonControls && (
              <View
                style={{
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: tournamentColors.white,
                  borderWidth: 1,
                  borderColor: tournamentColors.borderLight,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: tournamentColors.text }}>
                  Leg won — who won this game?
                </Text>
                <Text style={{ fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
                  Leg applies once per match (game 1 only) to decide who breaks. Later games: previous game winner
                  breaks.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[session.playerA, session.playerB].map((player) => {
                    const isSelected = String(legWinnerPlayerId) === String(player?.id);
                    return (
                      <Pressable
                        key={player?.id}
                        onPress={() => setLegWinnerPlayerId(player?.id)}
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: isSelected ? tournamentColors.primary : tournamentColors.borderLight,
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : tournamentColors.white,
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tournamentColors.text }}>
                          {player?.displayName || 'Player'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <ActionButton
                  label={isBusy ? 'Working…' : 'Leg won'}
                  onPress={() => {
                    if (!legWinnerPlayerId) {
                      showError('Select the player who won the leg.');
                      return;
                    }
                    setLegWonConfirmVisible(true);
                  }}
                  disabled={isBusy || !legWinnerPlayerId}
                  variant="secondary"
                  fullWidth
                />
              </View>
            )}

            {session?.canViewTurnLog && <CollapsibleTurnLog session={session} />}

            <CompletedGamesStrip session={session} />

            {canMark && legRequired && legWinnerName && (
              <View
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(236, 253, 245, 0.95)',
                  borderWidth: 1,
                  borderColor: 'rgba(34, 197, 94, 0.4)',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>
                  {legWinnerName} won this leg. Use End game to finish game {session?.activeGameNumber || 1}.
                </Text>
              </View>
            )}

            {(canMark || (session?.canEdit && isInProgress)) && (
              <EndGameDropdown
                session={session}
                selectedWinnerId={selectedWinnerId}
                onSelectWinner={setSelectedWinnerId}
                selectedEndReason={selectedEndReason}
                onSelectEndReason={setSelectedEndReason}
                onConfirm={onConfirmEndGame}
                isBusy={isBusy}
                disabled={!isActiveScorer}
              />
            )}
          </>
        )}

        {session?.status === 'completed' && (
          <Text style={{ color: tournamentColors.success, fontWeight: '700', fontSize: 15 }}>Match complete.</Text>
        )}

        {!session?.canEdit && (
          <Text style={{ color: tournamentColors.textMuted, fontSize: 14 }}>
            View-only — only the host or assigned proctors can open this session.
          </Text>
        )}

        {Boolean(errorMessage) && (
          <Text style={{ color: tournamentColors.error, fontSize: 14 }}>{errorMessage}</Text>
        )}
      </ScrollView>

      <ConfirmModal
        visible={legWonConfirmVisible}
        title="Confirm leg won"
        message={
          legWinnerPlayerId
            ? `Mark ${
                String(legWinnerPlayerId) === String(playerAId)
                  ? session?.playerA?.displayName
                  : session?.playerB?.displayName
              } as the leg winner for this game? You cannot mark another leg in the same game.`
            : 'Select a player first.'
        }
        confirmLabel="Leg won"
        onConfirm={async () => {
          setLegWonConfirmVisible(false);
          await onAdvanceTurn({ legWinnerPlayerId });
          setLegWinnerPlayerId(null);
        }}
        onCancel={() => setLegWonConfirmVisible(false)}
        isLoading={isBusy}
        emoji="🎱"
      />

      <ConfirmModal
        visible={confirmRequestTakeoverVisible}
        title="Request takeover"
        message={`Ask ${session?.sessionController?.displayName || 'the active scorer'} to hand off scoring for this match?`}
        confirmLabel="Request takeover"
        onConfirm={async () => {
          setConfirmRequestTakeoverVisible(false);
          await runAction(() => requestLiveMatchTakeover(tournamentId, gameId));
        }}
        onCancel={() => setConfirmRequestTakeoverVisible(false)}
        isLoading={isBusy}
        emoji="🎯"
      />

      <ConfirmModal
        visible={confirmHandOffVisible}
        title="Hand off scoring"
        message={`Give scoring to ${session?.takeoverRequest?.displayName || 'the requesting proctor'}? They will be able to mark this match.`}
        confirmLabel="Hand off scoring"
        onConfirm={async () => {
          setConfirmHandOffVisible(false);
          await runAction(() => handoffLiveMatchScoring(tournamentId, gameId));
        }}
        onCancel={() => setConfirmHandOffVisible(false)}
        isLoading={isBusy}
        emoji="🤝"
      />

      <ConfirmModal
        visible={confirmDeclineTakeoverVisible}
        title="Decline takeover"
        message={`Decline ${session?.takeoverRequest?.displayName || 'the proctor'}'s request to take over scoring?`}
        confirmLabel="Decline"
        onConfirm={async () => {
          setConfirmDeclineTakeoverVisible(false);
          await runAction(() => declineLiveMatchTakeover(tournamentId, gameId));
        }}
        onCancel={() => setConfirmDeclineTakeoverVisible(false)}
        isLoading={isBusy}
        emoji="✋"
      />

      <ConfirmModal
        visible={confirmForceTakeoverVisible}
        title="Take over scoring"
        message="Take over scoring for this match immediately? The current scorer will no longer be able to mark turns."
        confirmLabel="Take over"
        onConfirm={async () => {
          setConfirmForceTakeoverVisible(false);
          await runAction(() => forceTakeoverLiveMatchScoring(tournamentId, gameId));
        }}
        onCancel={() => setConfirmForceTakeoverVisible(false)}
        isLoading={isBusy}
        emoji="👑"
      />
    </View>
  );
}
