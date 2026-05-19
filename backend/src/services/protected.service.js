const buildProtectedPingPayload = (userId) => ({
  success: true,
  message: 'Protected route reached',
  data: {
    userId,
  },
});

module.exports = { buildProtectedPingPayload };
