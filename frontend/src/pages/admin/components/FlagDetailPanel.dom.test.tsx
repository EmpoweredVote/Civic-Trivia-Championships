import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FlagDetailPanel } from './FlagDetailPanel';
import { useAuthStore } from '../../../store/authStore';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * Archive and Dismiss are verdicts on a QUESTION — the admin never needed to know who
 * flagged it, which is why nobody noticed that this panel renders an empty name: the
 * detail endpoint returned only a UUID, and `{flag.username}` had always been undefined.
 *
 * "Thank" is the first action here that is about a PERSON, and it spends a real gem on a
 * real account. The things that can go wrong are therefore not visual:
 *   - thanking the wrong reporter, because the panel cannot name them
 *   - offering the button to an account that cannot receive the gem (Inform tier)
 *   - a second click paying a second gem
 *
 * NOT covered by this lane: layout, and whether the button is visually reachable — jsdom
 * computes no geometry. `check:tableau` and `smoke:game` are not in CI, so anything this
 * lane cannot see is unguarded; that is the argument for asserting behaviour here.
 */

const REPORTER = '4f3a9c1e-0000-4000-8000-000000000001';

const QUESTION = {
  id: 77,
  externalId: 'hou-087',
  text: 'How many members serve on the council?',
  options: ['Five', 'Seven', 'Nine', 'Eleven'],
  correctAnswer: 2,
  explanation: 'Nine members.',
  source: { name: 'City Charter', url: 'https://example.gov/charter' },
  learningContent: null,
  status: 'active',
};

/** An eligible reporter who has not been thanked yet. */
function eligibleFlag(over: Record<string, unknown> = {}) {
  return {
    id: 4812,
    userId: REPORTER,
    displayName: 'Mara Quinn',
    eligible: true,
    thankedAt: null,
    reasons: ['wrong-answer'],
    elaboration: "the answer is wrong, it changed in 2019",
    createdAt: '2026-10-12T00:00:00.000Z',
    ...over,
  };
}

function mountPanel() {
  return render(
    <MemoryRouter>
      <FlagDetailPanel
        questionId={77}
        onClose={() => {}}
        onQuestionArchived={() => {}}
        onFlagsDismissed={() => {}}
        onQuestionRestored={() => {}}
        onRefreshNeeded={() => {}}
      />
    </MemoryRouter>
  );
}

/** Respond to the detail fetch with these flags; record every other call. */
function serveFlags(flags: unknown[]) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (String(url).includes('/detail')) {
      return {
        ok: true,
        json: async () => ({ question: QUESTION, flags }),
      } as Response;
    }
    return { ok: true, json: async () => ({ success: true, thankedAt: '2026-10-14T09:00:00.000Z' }) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('FlagDetailPanel — thanking a reporter', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: 'test-token' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names the reporter instead of rendering a blank', async () => {
    serveFlags([eligibleFlag()]);
    mountPanel();

    expect(await screen.findByText('Mara Quinn')).toBeTruthy();
  });

  it('offers a thank button for an eligible reporter', async () => {
    serveFlags([eligibleFlag()]);
    mountPanel();

    const button = await screen.findByRole('button', { name: /thank/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it('awards the gem against that reporter’s flag id', async () => {
    const fetchMock = serveFlags([eligibleFlag()]);
    mountPanel();

    fireEvent.click(await screen.findByRole('button', { name: /thank/i }));

    await waitFor(() => {
      const thanked = fetchMock.mock.calls.find(([url]) => String(url).includes('/thank'));
      expect(thanked).toBeTruthy();
      // Keyed on the FLAG (4812), not the question (77) — a question can carry
      // several reporters and only the chosen one is paid.
      expect(String(thanked![0])).toContain('/flags/4812/thank');
      expect(thanked![1]?.method).toBe('POST');
    });
  });

  it('shows the thanked state and stops offering the button', async () => {
    serveFlags([eligibleFlag()]);
    mountPanel();

    fireEvent.click(await screen.findByRole('button', { name: /thank/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^thank/i })).toBeNull();
    });
    expect(screen.getByText(/thanked/i)).toBeTruthy();
  });

  it('cannot be clicked twice into a second gem', async () => {
    const fetchMock = serveFlags([eligibleFlag()]);
    mountPanel();

    const button = await screen.findByRole('button', { name: /thank/i });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      const thanks = fetchMock.mock.calls.filter(([url]) => String(url).includes('/thank'));
      expect(thanks).toHaveLength(1);
    });
  });

  it('refuses an Inform-tier reporter and says why', async () => {
    serveFlags([eligibleFlag({ eligible: false, displayName: 'dpark@example.com' })]);
    mountPanel();

    expect(await screen.findByText('dpark@example.com')).toBeTruthy();
    const button = screen.queryByRole('button', { name: /thank/i });
    // Either absent, or present-but-disabled with the reason shown.
    if (button) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/connected|empowered/i)).toBeTruthy();
  });

  it('renders an already-thanked reporter without a button', async () => {
    serveFlags([eligibleFlag({ thankedAt: '2026-10-13T12:00:00.000Z' })]);
    mountPanel();

    expect(await screen.findByText('Mara Quinn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^thank/i })).toBeNull();
    expect(screen.getByText(/thanked/i)).toBeTruthy();
  });

  it('surfaces a refusal instead of claiming the gem was sent', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/detail')) {
        return { ok: true, json: async () => ({ question: QUESTION, flags: [eligibleFlag()] }) } as Response;
      }
      return {
        ok: false,
        status: 409,
        json: async () => ({ error: 'That reporter has deleted their account' }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    mountPanel();

    fireEvent.click(await screen.findByRole('button', { name: /thank/i }));

    expect(await screen.findByText(/deleted their account/i)).toBeTruthy();
    // And the entry must NOT claim success.
    expect(screen.queryByText(/✓ thanked/i)).toBeNull();
  });
});
