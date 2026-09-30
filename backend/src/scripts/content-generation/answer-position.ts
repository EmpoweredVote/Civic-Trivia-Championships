/**
 * The answer position a question must use, as prompt text.
 *
 * CTC-ONLY. This deliberately does NOT live in externalIdentity.ts: that file is
 * vendored byte-identical into ev-accounts (src/trivia/utils/externalIdentity.ts),
 * where its tests live, and it sits at a different depth there -- so an import of
 * ../../services/questionQuality/answerPlacement.js cannot be carried across
 * unchanged. Keeping this separate lets externalIdentity.ts stay genuinely identical.
 */
import { mintForConfig } from './externalIdentity.js';
import { targetPosition } from '../../services/questionQuality/answerPlacement.js';

/**
 * The answer position each question in a batch must use, as prompt text.
 *
 * Position is a pure function of the external ID, so this table is the same on every
 * run and the generator can be told the target BEFORE it writes the options. That
 * ordering is the whole fix: `placeAnswer` used to sort four numeric options ascending
 * after generation and take whatever rank the true value landed at, and models bracket
 * the true value two-below/one-above, so the answer ranked third and C hit 61%.
 *
 * Emitted for every question, not only numeric ones -- the generator does not know which
 * of its questions will parse as a magnitude series, and the non-numeric path honours the
 * same hashed target by permuting.
 */
export function answerPositionTable(
  config: { externalIdPrefix?: string; collectionSlug: string },
  startId: number,
  endId: number
): string {
  const lines: string[] = [];
  for (let seq = startId; seq <= endId; seq++) {
    const id = mintForConfig(config, seq);
    lines.push(`  ${id} -> ${'ABCD'[targetPosition(id)]}`);
  }
  return lines.join('\n');
}
