export const DISCOVER_WALKTHROUGH_STEPS = [
  {
    title: 'Welcome to Rack-N-Roll',
    body: 'Discover billiards tournaments, join events, and track scores — all in one place.',
  },
  {
    title: 'Tournament board',
    body: 'Browse every event here. Pull down to refresh on Discover, or use search and filters to narrow the list.',
  },
  {
    title: 'Tap a tournament',
    body: 'Expand any card to see details, open the scoresheet, or request to join.',
  },
  {
    title: 'Host your own event',
    body: 'Ready to run a bracket? Tap here on Discover to launch a tournament and manage it from your dashboard.',
  },
];

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
};

export const WALKTHROUGH_MOCK_TOURNAMENTS = [
  {
    id: 'walkthrough-1',
    name: 'Friday Night 9-Ball Open',
    registrationStatus: 'open',
    registrationMode: 'public',
    startsAt: daysFromNow(3),
    location: { formattedAddress: 'Rack House Billiards, Toronto' },
    maxParticipants: 16,
    participantCount: 9,
    hostUserId: 'walkthrough-host',
  },
  {
    id: 'walkthrough-2',
    name: 'Spring Singles Classic',
    registrationStatus: 'open',
    registrationMode: 'public',
    startsAt: daysFromNow(8),
    location: { formattedAddress: 'Cue Club Downtown' },
    maxParticipants: 32,
    participantCount: 18,
    hostUserId: 'walkthrough-host-2',
  },
];
