import type { SpeakerDef } from './lines';

/**
 * English copy catalogue for Bobit dialogue.
 *
 * TODO(content): every string below is a placeholder standing in for a real content pass.
 *
 * ev-landing's lines are written for a scrolling marketing page ("why is this site SO long",
 * "yeah, I own this ledge") and must NOT be shipped here verbatim -- they are about a
 * different product and a different moment. The selection mechanism is ported; the voice is
 * not. See ev-landing's `docs/voice-and-tone.md` for house style before rewriting these.
 *
 * Keep them short. A bubble is drawn in the field canvas at figure scale, so anything past a
 * dozen words will not fit without wrapping into something that covers the Bobit saying it.
 */
export const MESSAGES: Record<string, string> = {
  // TODO(content): greeter, first visit
  'greet.first': 'Oh — hello.',
  // TODO(content): greeter, returning visitor
  'greet.returning': 'Back again!',
  // TODO(content): greeter, signed in and we know the name
  'greet.named': 'Hey {name}.',
  // TODO(content): nudge toward starting a match
  'nudge.play': 'Pick a collection?',
  // TODO(content): nudge toward the leaderboard
  'nudge.leaderboard': "There's a leaderboard, you know.",
  // TODO(content): idle chatter, no particular occasion
  'idle.a': 'Nice day for some civics.',
  'idle.b': 'I know a guy who knows his mayor.',
};

/**
 * Speaker definitions. `lines` is first-match-wins so priority is explicit; `pool` is an
 * unordered draw for cases where nothing outranks anything.
 *
 * TODO(content): the beat structure is a placeholder too -- it exists to prove the engine
 * resolves, not because these are the right moments for CTC.
 */
export const SPEAKERS: Record<string, SpeakerDef> = {
  greeter: {
    beats: [
      {
        at: 'wave',
        lines: [
          { id: 'greet.named', when: ['loggedIn', 'named'] },
          { id: 'greet.returning', when: ['returning'] },
          { id: 'greet.first' },
        ],
      },
      {
        at: 'nudge',
        pool: [
          { id: 'nudge.play' },
          { id: 'nudge.leaderboard', when: ['loggedIn'] },
          { id: ['idle.a', 'idle.b'] },
        ],
      },
    ],
  },
};

export function messageFor(id: string | null): string | null {
  if (!id) return null;
  return MESSAGES[id] ?? null;
}
