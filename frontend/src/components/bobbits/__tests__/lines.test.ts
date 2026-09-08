import { describe, it, expect, beforeEach } from 'vitest';
import { context, matches, register, resolve, resetSpeakers, fill } from '../dialogue/lines';

const at9am = new Date(2026, 8, 4, 9, 0, 0);
const at8pm = new Date(2026, 8, 4, 20, 0, 0);

beforeEach(() => resetSpeakers());

describe('context', () => {
  it('tags the morning', () => {
    expect(context({ now: at9am }).tags).toContain('morning');
  });

  it('tags the evening', () => {
    const tags = context({ now: at8pm }).tags;
    expect(tags).toContain('evening');
    expect(tags).not.toContain('morning');
  });

  it('tags anonymous when not logged in', () => {
    const tags = context({ now: at9am }).tags;
    expect(tags).toContain('anonymous');
    expect(tags).not.toContain('loggedIn');
  });

  it('tags loggedIn and named together when both hold', () => {
    const tags = context({ now: at9am, loggedIn: true, name: 'Chris' }).tags;
    expect(tags).toContain('loggedIn');
    expect(tags).toContain('named');
  });

  it('tags firstVisit unless returning is set', () => {
    expect(context({ now: at9am }).tags).toContain('firstVisit');
    expect(context({ now: at9am, returning: true }).tags).toContain('returning');
  });
});

describe('matches', () => {
  it('accepts a line with no condition', () => {
    expect(matches({ id: 'x' }, [])).toBe(true);
  });

  it('requires every tag -- when is an AND', () => {
    expect(matches({ id: 'x', when: ['a', 'b'] }, ['a', 'b'])).toBe(true);
    expect(matches({ id: 'x', when: ['a', 'b'] }, ['a'])).toBe(false);
  });
});

describe('resolve', () => {
  it('reports no match for an unregistered speaker', () => {
    expect(resolve('nobody', 'wave')).toEqual({ id: null, matched: false, aim: null });
  });

  it('reports no match for an unknown beat', () => {
    register('greeter', { beats: [{ at: 'wave', lines: [{ id: 'a' }] }] });
    expect(resolve('greeter', 'nope').matched).toBe(false);
  });

  it('takes the first line that fits, not the last', () => {
    register('greeter', {
      beats: [{
        at: 'wave',
        lines: [
          { id: 'specific', when: ['loggedIn'] },
          { id: 'fallback' },
        ],
      }],
    });
    expect(resolve('greeter', 'wave', { now: at9am, loggedIn: true }).id).toBe('specific');
    expect(resolve('greeter', 'wave', { now: at9am, loggedIn: false }).id).toBe('fallback');
  });

  it('distinguishes a deliberate silence from an authoring gap', () => {
    register('greeter', { beats: [{ at: 'wave', lines: [{ id: null }] }] });
    const r = resolve('greeter', 'wave', { now: at9am });
    expect(r.id).toBeNull();
    expect(r.matched).toBe(true); // matched a line that chose to say nothing
  });

  it('reports an authoring gap when nothing fits', () => {
    register('greeter', { beats: [{ at: 'wave', lines: [{ id: 'a', when: ['nonexistent'] }] }] });
    const r = resolve('greeter', 'wave', { now: at9am });
    expect(r.id).toBeNull();
    expect(r.matched).toBe(false);
  });

  it('carries the aim selector through', () => {
    register('greeter', { beats: [{ at: 'wave', lines: [{ id: 'a', aim: '.play-button' }] }] });
    expect(resolve('greeter', 'wave', { now: at9am }).aim).toBe('.play-button');
  });

  it('holds its choice across repeat calls, so text and aim cannot disagree', () => {
    register('greeter', {
      beats: [{ at: 'wave', pool: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }],
    });
    const first = resolve('greeter', 'wave', { now: at9am }).id;
    for (let i = 0; i < 25; i++) {
      expect(resolve('greeter', 'wave', { now: at9am }).id).toBe(first);
    }
  });

  it('holds one choice from an id array too', () => {
    register('greeter', { beats: [{ at: 'wave', lines: [{ id: ['x', 'y', 'z'] }] }] });
    const first = resolve('greeter', 'wave', { now: at9am }).id;
    expect(['x', 'y', 'z']).toContain(first);
    expect(resolve('greeter', 'wave', { now: at9am }).id).toBe(first);
  });

  it('only draws pool entries that fit the context', () => {
    register('greeter', {
      beats: [{
        at: 'wave',
        pool: [
          { id: 'loggedInOnly', when: ['loggedIn'] },
          { id: 'anonOnly', when: ['anonymous'] },
        ],
      }],
    });
    expect(resolve('greeter', 'wave', { now: at9am, loggedIn: true }).id).toBe('loggedInOnly');
  });
});

describe('fill', () => {
  it('substitutes the name token', () => {
    expect(fill('Hey {name}.', { name: 'Chris' })).toBe('Hey Chris.');
  });

  it('empties the token when there is no name', () => {
    expect(fill('Hey {name}.', { name: null })).toBe('Hey .');
  });

  it('replaces every occurrence', () => {
    expect(fill('{name}? {name}!', { name: 'A' })).toBe('A? A!');
  });
});
