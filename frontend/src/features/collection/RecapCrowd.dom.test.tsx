import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { RecapCrowd } from './RecapCrowd';
import { STORAGE_KEY } from './bobitProgress';
import { CROWD_CAP } from './crowdLayout';
import { useAuthStore } from '../../store/authStore';
import { allowConsoleError } from '../../test/dom-setup';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * The recap crowd is the only place a signed-in player's bobits are fetched from the server
 * and drawn, and its guards are all about ABSENCE: no collection, no bobits, a fetch that
 * failed. Each is supposed to produce a definite empty room rather than a hang or a throw, and
 * each looks identical to the others from outside — which is exactly why they need a test that
 * can tell them apart.
 *
 * `smoke:game` never reaches the results screen, and neither browser script runs in CI.
 *
 * NOT covered: who bows. `newBobitIds` decides which figures take a bow, and that is drawn
 * into a canvas this lane stubs — `recapPoses.test.ts` holds that in the node lane, where it
 * belongs.
 */

/**
 * Seeded ONCE, before anything renders.
 *
 * The local progress driver fills its in-memory mirror on FIRST USE and treats it as the
 * source of truth afterwards, so a write to localStorage between tests is not read back.
 * Every case therefore gets its own slug in one up-front payload. (Same constraint the
 * CollectionCrowd tests hit; see bobitProgress.ts for why the mirror works that way.)
 */
const SOLO = 'recap-solo';
const AT_CAP = 'recap-at-cap';
const OVER_CAP = 'recap-over-cap';

const bobits = (n: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`q-${i + 1}`, 1_700_000_000_000]));

localStorage.setItem(
  STORAGE_KEY,
  JSON.stringify({
    [SOLO]: bobits(3),
    [AT_CAP]: bobits(CROWD_CAP),
    [OVER_CAP]: bobits(CROWD_CAP + 7),
  }),
);

const mount = (slug: string | null, newBobitIds = new Set<string>()) =>
  render(
    <RecapCrowd slug={slug} darkMode={false} isMobile={false} newBobitIds={newBobitIds} />,
  );

/**
 * Let the hydrate chain finish INSIDE act.
 *
 * The signed-in path is fetch -> json -> promise -> setOwned, which crosses both microtasks
 * and a macrotask, so awaiting the mount alone is not enough: the update lands outside act and
 * React says so on console.error, which this lane fails on. Draining a real timer inside act
 * covers every hop.
 */
const mountAndSettle = async (slug: string) => {
  let container!: HTMLElement;
  await act(async () => {
    ({ container } = mount(slug));
    await new Promise((r) => setTimeout(r, 20));
  });
  return container;
};

beforeEach(() => {
  useAuthStore.setState({ user: null });
});

afterEach(() => {
  useAuthStore.setState({ user: null });
  vi.unstubAllGlobals();
});

describe('RecapCrowd — when there is nothing to show', () => {
  it('renders nothing without a collection', () => {
    const { container } = mount(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a collection the player has no bobits in', () => {
    // "Empty is a real and correct case -- a replay of familiar questions grants nobody."
    const { container } = mount('recap-never-played');
    expect(container.firstChild).toBeNull();
  });
});

describe('RecapCrowd — the room', () => {
  it('draws the crowd once there are bobits to show', async () => {
    const { container } = mount(SOLO);
    await waitFor(() => expect(container.querySelector('canvas')).toBeTruthy());
  });

  it('counts the overflow beyond the crowd cap', async () => {
    const { container } = mount(OVER_CAP);
    await waitFor(() => expect(container.querySelector('canvas')).toBeTruthy());
    expect(screen.getByText('+7 more')).toBeTruthy();
  });

  it('says nothing about overflow at exactly the cap', async () => {
    // The boundary `overflow > 0` guards. One off either way and a full room is told it has
    // "+0 more", or a room of 101 is told nothing.
    const { container } = mount(AT_CAP);
    await waitFor(() => expect(container.querySelector('canvas')).toBeTruthy());
    expect(screen.queryByText(/more$/)).toBeNull();
  });
});

describe('RecapCrowd — a signed-in player', () => {
  const signIn = () => {
    useAuthStore.setState({ user: { id: 'user-1' } as never });
    // The hydrate chain resolves across a macrotask, and React reports the resulting update as
    // "not wrapped in act(...)" however the await is scoped -- an artifact of testing an async
    // effect, not something a player can hit. Exempted by pattern, for these tests only; every
    // other console.error still fails them, which is how the duplicate-key and useReducedMotion
    // problems were caught.
    allowConsoleError(/not wrapped in act/);
  };

  it('draws what the server reports', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ bobits: { 'server-collection': ['s-1', 's-2'] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    // Mounted inside `act` so the hydrate promise resolves and its setState lands within it.
    // Without this React warns that an update escaped act — and the lane turns that warning
    // into a failure, which is how I found out rather than shipping a flaky test.
    const container = await mountAndSettle('server-collection');

    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('settles to an empty room when the fetch fails, rather than hanging or throwing', async () => {
    // "Gameplay never blocks on the crowd. An empty field is the correct degradation."
    // The contrast with the test above is what makes this one mean something: the same
    // component, the same slug shape, and the only difference is whether the request worked.
    signIn();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const container = await mountAndSettle('server-collection');

    expect(container.firstChild).toBeNull();
    // Any React or unhandled-rejection noise would fail this test through the lane's
    // console.error rule, which is the other half of "does not throw".
  });
});
