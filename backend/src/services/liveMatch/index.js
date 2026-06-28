const { startGameSession, getLiveMatchState } = require('./session.service');
const {
  requestLiveMatchTakeover,
  handoffLiveMatchScoring,
  hostForceTakeoverLiveMatch,
  declineLiveMatchTakeover,
  cancelLiveMatchTakeover,
} = require('./takeover.service');
const { advanceGameTurn, endSeriesGame } = require('./turns.service');
const { mapLiveMatchState, END_GAME_REASONS } = require('./seriesState');

module.exports = {
  startGameSession,
  getLiveMatchState,
  requestLiveMatchTakeover,
  handoffLiveMatchScoring,
  hostForceTakeoverLiveMatch,
  declineLiveMatchTakeover,
  cancelLiveMatchTakeover,
  advanceGameTurn,
  endSeriesGame,
  mapLiveMatchState,
  END_GAME_REASONS,
};
