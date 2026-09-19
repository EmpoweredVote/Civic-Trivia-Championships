import { BobitField } from '../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp } from '../../components/bobbits/fieldGeometry';
import { marginTreeX } from '../../components/bobbits/props';
import { groundLineFromBottom } from './crowdLayout';
import type { MarginBox } from './treePlacement';

interface TreeMarginProps {
  box: MarginBox;
  scale: number;
  /**
   * 0-1 while the tree is still sprouting, read PER FRAME.
   *
   * A callback, not a value: a number passed as a prop is frozen at the last React render, and
   * the sprout advances on the rAF clock. Passing it by value stalled the tree part-grown at
   * whatever height the last render happened to catch -- which a unit test cannot see and a
   * screenshot shows immediately.
   */
  growFor: () => number;
  darkMode: boolean;
  /** Everyone perched, climbing or descending, in THIS canvas's coordinates. */
  figuresFor: () => FieldFigure[];
}

/**
 * The tree's own canvas: the empty strip beside the question column, floor line to canopy.
 *
 * WHY A THIRD CANVAS. The band is 96px tall and in normal document flow, which is how "the
 * crowd never covers the question" is guaranteed rather than merely arranged. A tree ten times
 * that height cannot live there, and making the band taller would either steal the question
 * card's allowance or put an interactive canvas over the answer buttons.
 *
 * BOUND 1 IS GEOMETRY HERE. The canvas is `right: 0` with `width: box.width`, where `box.width`
 * was measured from the column's right edge to the band's -- so its left edge IS that edge, and
 * nothing drawn inside it can reach the card. `marginTree.test.ts` asserts the tree's whole ink
 * box and every branch edge stay inside it at every width. That is what lets this canvas stay
 * INTERACTIVE while the aerial overlay, which really does span the card, must not be: a bobit
 * can still be clicked and greeted from his branch.
 *
 * Two interactive BobitFields on one page is safe, and was checked rather than assumed: the
 * document- and window-level listeners are all cancel handlers (mouseup, blur, Escape, and a
 * context-menu suppressor guarded by that field's own gesture state), each acting on its own
 * refs, and the 60ms armPoll is a no-op without a pending touch on that field.
 *
 * Mounted INSIDE the crowd's wrapper, whose bottom edge is the band's bottom edge -- so
 * `bottom: groundLineFromBottom()` puts this canvas's bottom exactly on the floor line the
 * crowd walks on, from the same constant the floor line itself is drawn from. The canvas then
 * extends upward, out of the band's flow box and into the margin, taking none of the question
 * card's allowance.
 */
export function TreeMargin({ box, scale, growFor, darkMode, figuresFor }: TreeMarginProps) {
  // Light trunk on a dark ground and vice versa, exactly as the cannon learned to be: a fixed
  // dark prop is a smudge in dark mode.
  const color = darkMode ? '#9AA6B8' : '#4A5568';
  const propsFor = (): FieldProp[] => [{
    id: 'room:margin-tree',
    kind: 'marginTree',
    x: marginTreeX(box.width, scale),
    // The canvas's bottom edge IS the band's floor line, so the trunk stands on the same
    // ground the crowd walks on.
    groundY: box.height,
    scale,
    grow: growFor(),
    color,
  }];

  return (
    <div
      style={{
        position: 'absolute', right: 0, bottom: groundLineFromBottom(),
        width: box.width, height: box.height,
        // Behind the question column in z-order, so that even if a future layout change made
        // the boxes overlap, the card wins. Belt and braces over the geometry.
        zIndex: 0,
      }}
    >
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        propsFor={propsFor}
        height={box.height}
        interactive
      />
    </div>
  );
}
