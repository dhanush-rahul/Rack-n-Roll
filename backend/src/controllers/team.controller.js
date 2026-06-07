const {
  listTournamentTeams,
  listSoloPlayers,
  pickPartner,
  breakTeam,
  hostFormTeam,
  updateTeamDisplayName,
  randomPairSolos,
} = require('../services/team.service');

const listTournamentTeamsController = async (req, res, next) => {
  try {
    const result = await listTournamentTeams(req.params.tournamentId);
    return res.status(200).json({ success: true, data: { items: result } });
  } catch (error) {
    return next(error);
  }
};

const listSoloPlayersController = async (req, res, next) => {
  try {
    const result = await listSoloPlayers(req.params.tournamentId);
    return res.status(200).json({ success: true, data: { items: result } });
  } catch (error) {
    return next(error);
  }
};

const pickPartnerController = async (req, res, next) => {
  try {
    const result = await pickPartner(
      req.params.tournamentId,
      req.auth?.userId,
      req.body?.partnerPlayerId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const breakTeamController = async (req, res, next) => {
  try {
    const result = await breakTeam(req.params.tournamentId, req.auth?.userId, req.params.teamId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const hostFormTeamController = async (req, res, next) => {
  try {
    const result = await hostFormTeam(req.params.tournamentId, req.auth?.userId, req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const updateTeamDisplayNameController = async (req, res, next) => {
  try {
    const result = await updateTeamDisplayName(
      req.params.tournamentId,
      req.auth?.userId,
      req.params.teamId,
      req.body
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const randomPairTeamsController = async (req, res, next) => {
  try {
    const result = await randomPairSolos(req.params.tournamentId, req.auth?.userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listTournamentTeamsController,
  listSoloPlayersController,
  pickPartnerController,
  breakTeamController,
  hostFormTeamController,
  updateTeamDisplayNameController,
  randomPairTeamsController,
};
