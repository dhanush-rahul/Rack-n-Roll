export const tournamentColors = {
  background: '#f8fafc',
  primary: '#2563eb',
  primaryMuted: '#94a3b8',
  border: '#d1d5db',
  borderLight: '#e5e7eb',
  cardBorder: '#eef1f6',
  text: '#111827',
  textMuted: '#4b5563',
  error: '#b91c1c',
  success: '#065f46',
  warning: '#b45309',
  white: '#ffffff',
};

export const cardShadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const tournamentUi = {
  screen: {
    flex: 1,
    backgroundColor: tournamentColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderColor: tournamentColors.border,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    backgroundColor: tournamentColors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: tournamentColors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: tournamentColors.text,
  },
  tab: (active) => ({
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: active ? tournamentColors.primary : tournamentColors.white,
    borderWidth: 1,
    borderColor: active ? tournamentColors.primary : tournamentColors.border,
  }),
  tabText: (active) => ({
    color: active ? tournamentColors.white : tournamentColors.primary,
    fontWeight: '600',
    fontSize: 14,
  }),
  successText: {
    color: tournamentColors.success,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCard: {
    backgroundColor: tournamentColors.white,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalMessage: {
    color: tournamentColors.textMuted,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tournamentColors.primary,
  },
  primaryButtonText: {
    color: tournamentColors.white,
    fontWeight: '600',
  },
};

export const discoverUi = {
  hero: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
  },
  surfaceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tournamentColors.cardBorder,
    backgroundColor: tournamentColors.white,
    padding: 16,
    ...cardShadow,
  },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tournamentColors.cardBorder,
    backgroundColor: tournamentColors.white,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  monogram: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
};
