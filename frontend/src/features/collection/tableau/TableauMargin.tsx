import type { CSSProperties } from 'react';
import { BobitField } from '../../../components/bobbits/BobitField';
import type { FieldFigure, FieldProp } from '../../../components/bobbits/fieldGeometry';
import { groundLineFromBottom } from '../crowdLayout';
import { originX } from './tableauGeometry';
import type { MarginBox } from './tableauGeometry';
import type { StackSide, TableauLine } from './blueprint';

interface TableauMarginProps {
  side: StackSide;
  box: MarginBox;
  scale: number;
  darkMode: boolean;
  /**
   * How many lines are standing, read PER FRAME.
   *
   * A CALLBACK, not a number. A value passed as a prop is frozen at the last React render
   * while the build advances on the rAF clock -- which is how the margin tree's sprout once
   * stalled part-grown at whatever height React last happened to catch. A unit test cannot
   * see that; a screenshot shows it immediately.
   */
  builtFor: () => number;
  /**
   * The line currently going up, and its clock. A callback for the same reason `builtFor` is:
   * the build advances on rAF and a value prop would be frozen at the last React render.
   */
  siteFor: () => { line: TableauLine; t: number } | null;
  /** Everyone perched, climbing, descending or WORKING on THIS stack, in its coordinates. */
  figuresFor: () => FieldFigure[];
  /**
   * Forces a repaint when this canvas is NOT animating.
   *
   * Under reduced motion `BobitField` paints once and stops, so a line going up would never
   * reach the screen until the next resize or navigation. The band already had this; both
   * margins need it for the same reason, and for the same players.
   */
  repaintKey?: number;
}

/**
 * One stack's canvas: the empty strip beside the question column, floor line to canopy.
 *
 * WHY ITS OWN CANVAS. The band is 96px tall and in normal document flow, which is how "the
 * crowd never covers the question" is guaranteed rather than merely arranged. A tableau ten
 * times that height cannot live there, and making the band taller would either steal the
 * question card's allowance or put an interactive canvas over the answer buttons.
 *
 * BOUND 1 IS GEOMETRY HERE. The canvas is pinned to its own side of the shell with the
 * MEASURED margin width, so its inner edge IS the question column's edge, and nothing drawn
 * inside it can reach the card. `tableauGeometry.test.ts` asserts the whole ink box stays
 * inside at every width. That is what lets these canvases stay INTERACTIVE while the aerial
 * overlay, which really does span the card, must not be: a bobit can still be greeted from
 * his branch.
 *
 * Two interactive BobitFields on one page was already checked when the margin tree shipped;
 * this makes it three. The document- and window-level listeners are all cancel handlers, each
 * acting on its own refs, and the 60ms armPoll is a no-op without a pending touch.
 *
 * Mounted INSIDE the crowd's wrapper, whose bottom edge is the band's bottom edge, so
 * `bottom: groundLineFromBottom()` puts this canvas's bottom exactly on the floor line the
 * crowd walks on -- from the same constant the floor line itself is drawn from.
 */
export function TableauMargin({
  side, box, scale, darkMode, builtFor, siteFor, figuresFor, repaintKey,
}: TableauMarginProps) {
  // Light timber on a dark ground and vice versa, exactly as the cannon learned to be: a fixed
  // dark prop is a smudge in dark mode.
  const color = darkMode ? '#9AA6B8' : '#4A5568';
  // The one colour in the tableau that is not the body colour. Derived per theme for the same
  // reason -- a single green that works on both backgrounds does not exist.
  const leafColor = darkMode ? '#7FB069' : '#4F7942';

  const propsFor = (): FieldProp[] => [{
    id: `room:tableau:${side}`,
    kind: 'tableau',
    side,
    built: builtFor(),
    site: siteFor(),
    x: originX(side, box.width, scale),
    // The canvas's bottom edge IS the band's floor line, so the stack stands on the same
    // ground the crowd walks on.
    groundY: box.height,
    scale,
    color,
    leafColor,
  }];

  const place: CSSProperties = {
    position: 'absolute',
    bottom: groundLineFromBottom(),
    width: box.width,
    height: box.height,
    // NO z-index, and no pretending one would help. This used to carry `zIndex: 0` with a
    // comment calling it belt and braces over the geometry -- the belt was on backwards (M6).
    // Nothing between this div and the root creates a stacking context, and the question
    // column and its ancestors are all `position: static`, so in paint order a POSITIONED
    // z-index:0 element lands in step 8 and a non-positioned block in step 4: the canvas would
    // have painted IN FRONT of the card, which is the exact failure the comment promised to
    // prevent. Measured in the browser rather than reasoned about, after the comment had
    // already been believed once.
    //
    // So bound 1 rests on geometry ALONE -- this box is pinned to its own outer edge with the
    // measured margin width, so its inner edge IS the question column's edge and nothing drawn
    // inside can reach the card. `tableauGeometry.test.ts` holds that at every width. Treat it
    // as the only guarantee there is, because it is; z-order is not available as a backstop
    // here and a negative z-index would risk painting the stack behind an ancestor's
    // background, which is how bobits vanish.
    // Each stack hugs its OWN outer edge, so the slack always opens on the card's side.
    ...(side === 'left' ? { left: 0 } : { right: 0 }),
  };

  return (
    <div style={place}>
      <BobitField
        figures={[]}
        figuresFor={figuresFor}
        propsFor={propsFor}
        height={box.height}
        repaintKey={repaintKey}
        interactive
      />
    </div>
  );
}
