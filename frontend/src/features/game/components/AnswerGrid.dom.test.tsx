import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnswerGrid } from './AnswerGrid';
import type { GamePhase } from '../../../types/game';

/**
 * WHY THIS FILE EXISTS
 * --------------------
 * This is the keyboard surface a player who does not use a mouse plays the whole game
 * through: roving focus with the arrow keys, Enter or Space to commit, and number keys as a
 * shortcut. Every one of those paths branches on phase, and the branch that matters most —
 * "Enter selects, or locks in, depending on whether anything is selected yet" — is three
 * lines of switch with no other gate in front of it.
 *
 * It is distinct from the window-level handler covered in GameScreen.dom.test.tsx: that one
 * exists for when the grid does NOT have focus. This is the one that runs when it does, and
 * nothing tested it.
 *
 * NOT covered: what any of it looks like. The grid's whole visual language — the colour a
 * locked answer turns, the reveal animation — is layout and paint, which this lane cannot see.
 */

const OPTIONS = ['Five', 'Seven', 'Nine', 'Eleven'];

const mount = (phase: GamePhase, over: Partial<Parameters<typeof AnswerGrid>[0]> = {}) => {
  const onSelect = vi.fn();
  const onLockIn = vi.fn();
  const utils = render(
    <AnswerGrid
      options={OPTIONS}
      selectedOption={null}
      correctAnswer={2}
      phase={phase}
      onSelect={onSelect}
      onLockIn={onLockIn}
      explanation="The council has nine members."
      {...over}
    />,
  );
  return { ...utils, onSelect, onLockIn };
};

/** The buttons, in grid order. Each is labelled "Option A: Five" and so on. */
const buttons = () => screen.getAllByRole('button') as HTMLButtonElement[];

describe('AnswerGrid — choosing with the mouse', () => {
  it('reports the option that was clicked', () => {
    const { onSelect } = mount('answering');

    fireEvent.click(buttons()[2]);

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('is disabled once the answer is locked', () => {
    const { onSelect } = mount('locked', { selectedOption: 1 });

    expect(buttons()[0].disabled).toBe(true);
    fireEvent.click(buttons()[0]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('is disabled once the answer is revealed', () => {
    const { onSelect } = mount('revealing', { selectedOption: 1 });

    expect(buttons()[3].disabled).toBe(true);
    fireEvent.click(buttons()[3]);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('AnswerGrid — moving between options', () => {
  it('walks down with ArrowDown', () => {
    mount('answering');

    fireEvent.keyDown(buttons()[0], { key: 'ArrowDown' });

    expect(document.activeElement).toBe(buttons()[1]);
  });

  it('wraps from the last option back to the first', () => {
    mount('answering');

    fireEvent.keyDown(buttons()[3], { key: 'ArrowDown' });

    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('walks up with ArrowUp, wrapping the other way', () => {
    mount('answering');

    fireEvent.keyDown(buttons()[0], { key: 'ArrowUp' });

    expect(document.activeElement).toBe(buttons()[3]);
  });

  it('does not move focus once the answer is locked', () => {
    mount('locked', { selectedOption: 1 });

    fireEvent.keyDown(buttons()[0], { key: 'ArrowDown' });

    expect(document.activeElement).not.toBe(buttons()[1]);
  });
});

describe('AnswerGrid — Enter and Space', () => {
  it.each([[' '], ['Enter']])('%s selects the focused option when nothing is chosen yet', (key) => {
    const { onSelect, onLockIn } = mount('answering', { selectedOption: null });

    fireEvent.keyDown(buttons()[1], { key });

    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onLockIn).not.toHaveBeenCalled();
  });

  it.each([[' '], ['Enter']])('%s locks in when an option is already chosen', (key) => {
    // The second press is a commit, not a re-selection. Collapse this branch and the player
    // can never lock in from the keyboard — they would just keep re-picking the same answer.
    const { onSelect, onLockIn } = mount('answering', { selectedOption: 1 });

    fireEvent.keyDown(buttons()[1], { key });

    expect(onLockIn).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('locks in during the selected phase', () => {
    // `selected` is the final question's confirm step, where the only thing left to do is
    // commit — so Enter must lock in even on an option the player is merely focused on.
    const { onSelect, onLockIn } = mount('selected', { selectedOption: 3 });

    fireEvent.keyDown(buttons()[0], { key: 'Enter' });

    expect(onLockIn).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing once the answer is locked', () => {
    const { onSelect, onLockIn } = mount('locked', { selectedOption: 1 });

    fireEvent.keyDown(buttons()[1], { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(onLockIn).not.toHaveBeenCalled();
  });
});

describe('AnswerGrid — number keys', () => {
  it('jumps to the numbered option and takes focus with it', () => {
    const { onSelect } = mount('answering');

    fireEvent.keyDown(buttons()[0], { key: '4' });

    expect(onSelect).toHaveBeenCalledWith(3);
    expect(document.activeElement).toBe(buttons()[3]);
  });

  it('ignores a number outside the four options', () => {
    const { onSelect } = mount('answering');

    fireEvent.keyDown(buttons()[0], { key: '5' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores them once the answer is revealed', () => {
    const { onSelect } = mount('revealing', { selectedOption: 1 });

    fireEvent.keyDown(buttons()[0], { key: '2' });

    expect(onSelect).not.toHaveBeenCalled();
  });
});
