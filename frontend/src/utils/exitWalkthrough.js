/**
 * Leaves a walkthrough screen and lands on `targetScreen` without leaving a
 * leftover/duplicate entry in the stack.
 *
 * Walkthroughs can be entered two ways:
 *  - Auto-open: the Home focus effect uses `replace`, so the walkthrough sits
 *    in place of the target (e.g. stack is just [Walkthrough]).
 *  - Info/tour button: the header uses `navigate`, so the walkthrough is pushed
 *    on top of the screen it was launched from (e.g. [Home, Walkthrough] or
 *    [Home, CreateTournament, Walkthrough]).
 *
 * If the screen directly beneath the walkthrough is already the target we simply
 * pop back to it; otherwise we replace the walkthrough with the target. This
 * avoids duplicate entries (which previously produced a stray back button on the
 * root screen and a back-button loop on Create Tournament).
 */
export function exitWalkthroughTo(navigation, targetScreen, targetParams) {
  const state = navigation.getState?.();
  const routes = state?.routes ?? [];
  const previousRoute = routes[routes.length - 2];

  if (previousRoute?.name === targetScreen) {
    navigation.goBack();
    return;
  }

  navigation.replace(targetScreen, targetParams);
}
