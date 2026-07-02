export const CREATE_TOURNAMENT_WALKTHROUGH_STEPS = [
  {
    title: 'Host a tournament',
    body: 'Launch an event in a few steps. Rack-N-Roll handles registration, brackets, and scoring once you go live.',
  },
  {
    title: 'Tournament details',
    body: 'Name your event, set the player cap (or tap a preset), and enter where it is held — this is what players see on Discover.',
    highlightSection: 'details',
  },
  {
    title: 'Singles',
    body: 'One player per side. Tap Singles to run an individual bracket — handicap and proctored scoring options appear under Match format.',
    highlightSection: 'format',
    formatMode: 'singles',
  },
  {
    title: 'Doubles',
    body: 'Two players per team with manual team scoring. Tap Doubles, then choose how teams form — players pick a partner or you assign teams from the Players tab.',
    highlightSection: 'format',
    formatMode: 'doubles',
    scrollAnchor: 'teamFormation',
  },
  {
    title: 'Match format',
    body: 'Pick how many games each group-stage match plays. Singles hosts can turn on handicap and proctored scoring.',
    highlightSection: 'match',
  },
  {
    title: 'Registration',
    body: 'Public lets anyone on Discover request a spot. Invite only requires a code you share with players.',
    highlightSection: 'registration',
  },
  {
    title: 'Schedule',
    body: 'Tap the date and time fields to open the picker. Choose when play begins.',
    highlightSection: 'schedule',
  },
  {
    title: 'Launch tournament',
    body: 'Review the preview, then tap Launch tournament at the bottom. Your event goes live on Discover right away.',
    highlightSection: 'launch',
  },
];

export const WALKTHROUGH_SECTION_ORDER = [
  'details',
  'format',
  'match',
  'registration',
  'schedule',
  'launch',
];

export const SECTION_FIRST_STEP_INDEX = Object.fromEntries(
  WALKTHROUGH_SECTION_ORDER.map((sectionId) => [
    sectionId,
    CREATE_TOURNAMENT_WALKTHROUGH_STEPS.findIndex((step) => step.highlightSection === sectionId),
  ])
);
