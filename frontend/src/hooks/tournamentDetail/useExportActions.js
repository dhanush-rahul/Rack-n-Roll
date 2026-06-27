import { useCallback, useState } from 'react';
import {
  downloadTournamentExport,
  emailTournamentExport,
} from '../../services/tournamentService';
import { formatApiError } from '../useScreenFeedback';

export function useExportActions({ tournamentId, detail, clearAll, showError, showSuccess }) {
  const [isExportingWorkbook, setIsExportingWorkbook] = useState(false);
  const [isEmailExporting, setIsEmailExporting] = useState(false);

  const onExportWorkbook = useCallback(async () => {
    if (!tournamentId) return;
    try {
      clearAll();
      setIsExportingWorkbook(true);
      await downloadTournamentExport(tournamentId, detail?.name || 'tournament');
      showSuccess('Tournament export ready.');
    } catch (error) {
      showError(formatApiError(error, 'Unable to export tournament'));
    } finally {
      setIsExportingWorkbook(false);
    }
  }, [clearAll, detail?.name, showError, showSuccess, tournamentId]);

  const onEmailExportWorkbook = useCallback(async () => {
    if (!tournamentId) return;
    try {
      clearAll();
      setIsEmailExporting(true);
      const result = await emailTournamentExport(tournamentId);
      showSuccess(`Export emailed to ${result?.sentTo || 'your account'}.`);
    } catch (error) {
      if (error?.code === 'EMAIL_NOT_CONFIGURED') {
        showError(
          'Server email is not configured. Set MAIL_DELIVERY_MODE=smtp and SMTP settings in backend/.env, then try again.'
        );
        return;
      }
      showError(formatApiError(error, 'Unable to email tournament export'));
    } finally {
      setIsEmailExporting(false);
    }
  }, [clearAll, showError, showSuccess, tournamentId]);

  return { isExportingWorkbook, isEmailExporting, onExportWorkbook, onEmailExportWorkbook };
}
