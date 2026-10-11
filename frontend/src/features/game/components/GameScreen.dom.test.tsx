import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { GameScreen } from './GameScreen';
import { initialGameState } from '../gameReducer';
import type { GameState, Question } from '../../../types/game';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * GameScreen attaches THREE window-level keydown listeners — number keys to pick an answer,
 * Escape to pause, Space/Enter to advance a reveal — each with its own phase guard and its own
 * cleanup. Keyboard wiring and effect teardown are the exact class the 2026-09-09 defects came
 * from, and until this lane existed they were verified by reading the code.
 *
 * `smoke:game` drives one question in a real browser, but it does not run in CI, it never
 * unmounts anything, and it uses the mouse. A listener left attached after unmount, or a guard
 * that stops guarding, is invisible to it.
 *
 * NOT covered here: anything about layout. GameScreen measures the margins either side of the
 * question column and hands them to the tableau; in jsdom every box is 0x0, so that
 * measurement is meaningless and is left to `check:tableau`.
 */

const QUESTION: Question = {
  id: 'q-1',
  text: 'How many members serve on the city council?',
  options: ['Five', 'Seven', 'Nine', 'Eleven'],
  correctAnswer: 2,
  explanation: 'The council has nine members.',
  difficulty: 'easy',
  topic: 'Congress',
  topicCategory: 'congress',
};

const answeringState = (over: Partial<GameState> = {}): GameState => ({
  ...initialGameState,
  phase: 'answering',
  sessionId: 'session-1',
  questions: [QUESTION],
  totalQuestions: 5,
  currentQuestionIndex: 0,
  ...over,
});

/** Every handler the screen is given, so a test can assert which one fired. */
const handlers = () => ({
  startGame: vi.fn(async () => {}),
  selectAnswer: vi.fn(),
  lockAnswer: vi.fn(),
  handleTimeout: vi.fn(),
  quitGame: vi.fn(),
  nextQuestion: vi.fn(),
  setHasShownTooltip: vi.fn(),
  setWagerAmount: vi.fn(),
  lockWager: vi.fn(),
  pauseGame: vi.fn(),
  resumeGame: vi.fn(),
  onFlagToggle: vi.fn(),
});

/**
 * The screen shows the question alone for a beat before the options appear, and the number-key
 * handler is gated on that (`state.phase === 'answering' && showOptions`). Tests that press a
 * key have to wait for it, exactly as a player does.
 *
 * Kept as a real-timer wait rather than fake timers: the countdown library drives itself from
 * rAF, and freezing the clock under it tests a screen no player ever sees.
 */
const QUESTION_PREVIEW_MS = 1000;

function mount(state: GameState, h = handlers()) {
  const utils = render(
    <GameScreen
      state={state}
      currentQuestion={QUESTION}
      hasShownTooltip
      isFinalQuestion={false}
      flaggedQuestions={new Set()}
      isRateLimited={false}
      xpData={null}
      isXpLoading={false}
      isXpConnected={false}
      {...h}
    />,
  );
  /** Resolves once the options are interactive and the number keys are live. */
  const optionsShown = () =>
    waitFor(() => expect(utils.getByText(QUESTION.options[0])).toBeTruthy(), {
      timeout: QUESTION_PREVIEW_MS + 2000,
    });
  return { ...utils, h, optionsShown };
}

describe('GameScreen — number keys', () => {
  it('selects the matching answer while answering', async () => {
    const { h, optionsShown } = mount(answeringState());
    await optionsShown();

    fireEvent.keyDown(window, { key: '3' });

    expect(h.selectAnswer).toHaveBeenCalledTimes(1);
    expect(h.selectAnswer.mock.calls[0][0]).toBe(2); // 1-based key, 0-based index
  });

  it('ignores keys outside 1-4', async () => {
    const { h, optionsShown } = mount(answeringState());
    await optionsShown();

    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: 'a' });

    expect(h.selectAnswer).not.toHaveBeenCalled();
  });

  it('ignores them once the answer is revealed', () => {
    // The guard that stops a player changing their answer after the reveal starts.
    const { h } = mount(answeringState({ phase: 'revealing', selectedOption: 1 }));

    fireEvent.keyDown(window, { key: '2' });

    expect(h.selectAnswer).not.toHaveBeenCalled();
  });
});

describe('GameScreen — Escape', () => {
  it('pauses while answering', () => {
    const { h } = mount(answeringState());

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(h.pauseGame).toHaveBeenCalledTimes(1);
  });

  // NOT TESTED HERE: Escape while ALREADY paused. Rendering that state mounts the pause
  // overlay, whose focus trap refuses to initialise in jsdom -- "must have at least one
  // container with at least one tabbable node" -- because jsdom gives every element a zero
  // box and the trap reads visibility from layout. The other half of the same guard (the
  // phase check) is covered below, and the paused overlay itself belongs to `smoke:game`.

  it('does not pause during a reveal', () => {
    const { h } = mount(answeringState({ phase: 'revealing', selectedOption: 2 }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(h.pauseGame).not.toHaveBeenCalled();
  });
});

describe('GameScreen — advancing a reveal', () => {
  it.each([[' '], ['Enter']])('%s moves to the next question', (key) => {
    // One mount per key. The first draft pressed both against the same mount and asserted the
    // second did nothing, which passed for a reason that had nothing to do with Enter.
    const { h } = mount(answeringState({ phase: 'revealing', selectedOption: 2 }));

    fireEvent.keyDown(window, { key });

    expect(h.nextQuestion).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the player is still answering', () => {
    const { h } = mount(answeringState());

    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(h.nextQuestion).not.toHaveBeenCalled();
  });
});

describe('GameScreen — teardown', () => {
  it('takes all three listeners with it when it unmounts', async () => {
    // Three separate effects attach to `window`, and each returns its own cleanup. A leak here
    // is invisible in a browser script, which never unmounts the screen: the keys would simply
    // keep working on whatever came next.
    const { h, unmount, optionsShown } = mount(answeringState());
    await optionsShown();
    unmount();

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: ' ' });

    expect(h.selectAnswer).not.toHaveBeenCalled();
    expect(h.pauseGame).not.toHaveBeenCalled();
    expect(h.nextQuestion).not.toHaveBeenCalled();
  });
});
