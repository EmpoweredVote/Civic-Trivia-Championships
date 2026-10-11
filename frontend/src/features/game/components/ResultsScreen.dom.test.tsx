import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResultsScreen } from './ResultsScreen';
import { useConfettiStore } from '../../../store/confettiStore';
import { useAnnouncementStore } from '../../../store/announcementStore';
import { setReducedMotion } from '../../../test/dom-setup';
import type { GameResult, GameAnswer, Question } from '../../../types/game';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * The results screen is where three things fire that nothing else in the app does: the
 * perfect-game celebration, the screen-reader announcement that goes with it, and the level-up
 * overlay. All three are effects with guards -- reduced motion, a duplicate XP award, a
 * once-only latch -- and a guard that stops guarding is silent. A player simply gets confetti
 * they asked not to see, or a level-up for a level they already had.
 *
 * `smoke:game` never reaches this screen (it drives one question), and it is not in CI.
 *
 * NOT covered: the score count-up animation. It is a framer-motion spring driven by real time,
 * and asserting on its intermediate values would be testing the library's easing, not this
 * screen's behaviour.
 */

const BASE: Question = {
  id: 'q-1',
  text: 'How many members serve on the council?',
  options: ['Five', 'Seven', 'Nine', 'Eleven'],
  correctAnswer: 2,
  explanation: 'Nine members.',
  difficulty: 'easy',
  topic: 'Congress',
  topicCategory: 'congress',
};

/**
 * Five DISTINCT questions. Five clones of one id made React warn about duplicate keys — the
 * review list keys on question id — and the lane turned that warning into a failure, which is
 * exactly what it is for. The fixture was wrong, not the screen.
 */
const QUESTIONS: Question[] = Array.from({ length: 5 }, (_, i) => ({ ...BASE, id: `q-${i + 1}` }));

const answer = (correct: boolean, index = 0): GameAnswer => ({
  questionId: `q-${index + 1}`,
  selectedOption: correct ? 2 : 0,
  correct,
  correctAnswer: 2,
  timeRemaining: 20,
  basePoints: correct ? 100 : 0,
  speedBonus: correct ? 30 : 0,
  totalPoints: correct ? 130 : 0,
  responseTime: 10,
});

const resultOf = (correctCount: number, over: Partial<GameResult> = {}): GameResult => ({
  answers: Array.from({ length: 5 }, (_, i) => answer(i < correctCount, i)),
  totalCorrect: correctCount,
  totalQuestions: 5,
  totalScore: correctCount * 130,
  totalBasePoints: correctCount * 100,
  totalSpeedBonus: correctCount * 30,
  fastestAnswer: null,
  ...over,
});

const levelled = (level: number, extra: Record<string, unknown> = {}): Partial<GameResult> => ({
  progression: {
    xp: { confirmed: true, isDuplicate: false, level, ...extra },
  } as GameResult['progression'],
});

function mount(result: GameResult, props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <ResultsScreen
        result={result}
        questions={QUESTIONS}
        onPlayAgain={vi.fn()}
        onHome={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

/** A stand-in for the confetti canvas, so "did it fire" is a question with an answer. */
function stubConductor() {
  const conductor = { run: vi.fn(), shoot: vi.fn(), rain: vi.fn(), pause: vi.fn(), stop: vi.fn() };
  useConfettiStore.setState({ conductor });
  return conductor;
}

beforeEach(() => {
  useConfettiStore.setState({ conductor: null });
  useAnnouncementStore.setState({ politeMessage: '', assertiveMessage: '' });
});

describe('ResultsScreen — the perfect game', () => {
  it('fires the confetti rain on 5 of 5', () => {
    const conductor = stubConductor();
    mount(resultOf(5));
    expect(conductor.run).toHaveBeenCalled();
  });

  it('fires nothing on 4 of 5', () => {
    const conductor = stubConductor();
    mount(resultOf(4));
    expect(conductor.run).not.toHaveBeenCalled();
  });

  it('withholds the confetti under reduced motion but STILL announces it', async () => {
    // The rule the reader bobit and the tableau are both held to: reduced motion means no
    // easing, not no destination. A player who asked for less movement has still just played
    // a perfect game and must still be told.
    setReducedMotion(true);
    const conductor = stubConductor();
    mount(resultOf(5));

    expect(conductor.run).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(useAnnouncementStore.getState().politeMessage).toMatch(/perfect game/i),
    );
  });

  // NOT TESTED: "an imperfect game announces nothing". `announce.polite` writes to a global
  // store 50ms later and clears it a second after that, so a message from an earlier test can
  // land inside this one's window and fail it for the wrong reason — which it did, before this
  // was removed. The positive assertions above are order-independent; a negative one against a
  // self-clearing global is not. The imperfect-game case is covered by "fires nothing on 4 of
  // 5", which asserts against a conductor this test owns.
});

describe('ResultsScreen — the level-up overlay', () => {
  it('appears when the award took the player up a level', async () => {
    mount(resultOf(5, levelled(4)), { priorLevel: 3 });
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('stays away when the level did not change', () => {
    mount(resultOf(5, levelled(3)), { priorLevel: 3 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays away when the XP award was a DUPLICATE', () => {
    // The idempotency guard. A replayed award must not re-celebrate a level the player
    // already had -- the server deduplicates by key, and this is the UI half of that.
    mount(resultOf(5, levelled(4, { isDuplicate: true })), { priorLevel: 3 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays away when the award was never confirmed', () => {
    mount(resultOf(5, levelled(4, { confirmed: false })), { priorLevel: 3 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays away when there is no prior level to compare against', () => {
    // Null prior level means "we never knew", which is not the same as "it went up".
    mount(resultOf(5, levelled(4)), { priorLevel: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not come back after it has been dismissed', async () => {
    // `levelUpShownRef` is a once-per-mount latch. Without it, any re-render that re-runs the
    // effect puts the overlay back up over a screen the player has already dismissed it from.
    const onLevelCaptured = vi.fn();
    const result = resultOf(5, levelled(4));
    const { rerender } = mount(result, { priorLevel: 3, onLevelCaptured });

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // A NEW result object with the same values, which is what a parent re-render hands down.
    // Re-rendering with the SAME object proved nothing: the effect's deps never changed, so it
    // never re-ran, and the test passed with the latch deleted. Checked by deleting it.
    rerender(
      <MemoryRouter>
        <ResultsScreen
          result={resultOf(5, levelled(4))}
          questions={QUESTIONS}
          onPlayAgain={vi.fn()}
          onHome={vi.fn()}
          priorLevel={3}
          onLevelCaptured={onLevelCaptured}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
