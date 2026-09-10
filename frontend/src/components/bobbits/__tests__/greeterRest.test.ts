import { describe, it, expect } from 'vitest';
import { ALL_ANIMATIONS } from '../rigExtras';
import { pelvisOffset } from '../fieldGeometry';

describe('the card greeter rest pose', () => {
  it('uses a pose the rig reports as seated, so hover resolves to greetseat', () => {
    expect(ALL_ANIMATIONS.sit).toBeDefined();
    expect(ALL_ANIMATIONS.sit.seated).toBe(true);
  });

  it('sits at the same pelvis offset as the wave it replaces, so it does not jump', () => {
    expect(pelvisOffset('sit')).toBe(pelvisOffset('greetseat'));
  });

  it('still has a wave to hand off to', () => {
    expect(ALL_ANIMATIONS.greetseat).toBeDefined();
    expect(ALL_ANIMATIONS.greetseat.seated).toBe(true);
  });
});
