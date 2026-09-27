/**
 * Source Support — reading a cited source against the claim it is supposed to establish.
 *
 * Stage two of the source-drift check. Stage one (`checkSourceDrift` in the rules engine)
 * is a free heuristic that narrows the bank to questions whose claim rests on a rule,
 * ranking or count an outside body can change. This module does the part a heuristic
 * cannot: fetches the source and asks whether it still says what we claim it says.
 *
 * Deliberately free of any database import. The orchestration that selects questions and
 * records results lives in `scripts/audit-source-support.ts`; everything here is I/O
 * against a URL and a model, so it can be exercised without a database connection. That
 * split was not the original shape — it was forced by discovering that importing the
 * script to test one function opened a Postgres pool.
 */

/** How much of a page we are willing to send to the judge in one call. */
export const MAX_SOURCE_CHARS = 40_000;

/** Hard ceiling on what we hold in memory from one fetch. */
export const MAX_FETCH_CHARS = 400_000;

/** Matches the excerpt length the news lane already stores in fact_snapshot. */
export const MAX_SNAPSHOT_CHARS = 400;

export type Verdict = 'supported' | 'not-established' | 'unreachable';

export interface Judgement {
  verdict: Verdict;
  excerpt: string;
  reasoning: string;
}

/**
 * Strip a fetched page to something worth sending. Deliberately crude: we are looking
 * for whether a sentence appears, not rendering the document.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchSource(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'CivicTriviaChampionship-SourceAudit/1.0' },
    });
    if (!res.ok) return null;
    return toPlainText(await res.text()).slice(0, MAX_FETCH_CHARS);
  } catch {
    return null;
  }
}

/** Words too common to tell one part of a page from another. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'were', 'which', 'what', 'that', 'this', 'with', 'from',
  'how', 'many', 'does', 'did', 'has', 'have', 'its', 'his', 'her', 'their', 'answer',
  'treated', 'correct', 'question', 'about', 'into', 'serve', 'serves', 'state', 'states',
  'whose', 'where', 'when', 'who', 'why', 'is', 'of', 'in', 'on', 'at', 'to', 'as', 'by',
]);

/** Adjacent word pairs from the claim, keeping only pairs that carry meaning. */
function claimPhrases(claim: string): string[] {
  const words = claim.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  const phrases: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const [a, b] = [words[i], words[i + 1]];
    if (STOPWORDS.has(a) && STOPWORDS.has(b)) continue;
    if (a.length < 3 && b.length < 3) continue;
    phrases.push(`${a} ${b}`);
  }
  return [...new Set(phrases)];
}

/**
 * Pick the slice of a long page most likely to contain the supporting sentence.
 *
 * Taking the FIRST `MAX_SOURCE_CHARS` is what the original version did, and it was
 * wrong in a way that matters. Measured on 2026-09-27: Wikipedia's Louisiana article is
 * 233,556 characters of plain text, and the sentences establishing `lou-008` ("64
 * parishes") and `lou-065` ("civil law") sit at index 106,740 and 107,696 -- three times
 * beyond a 40,000-character head. Both questions came back "not-established" from a page
 * that states both facts plainly.
 *
 * That is the most dangerous failure this tool can have. A false "not-established" sends
 * a human to correct a question that was already right, which is precisely the mistake
 * the Alexandria mayor and Phoenix city manager near-misses were recorded to prevent.
 *
 * Scoring by distinctive claim terms costs no extra tokens -- the window sent is the same
 * size -- it just stops being the wrong window.
 */
export function selectRelevantWindow(
  text: string,
  claim: string,
  maxChars: number = MAX_SOURCE_CHARS
): string {
  if (text.length <= maxChars) return text;

  const terms = [...new Set(claim.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [])].filter(
    t => !STOPWORDS.has(t)
  );
  if (terms.length === 0) return text.slice(0, maxChars);

  const phrases = claimPhrases(claim);
  const lower = text.toLowerCase();
  const step = Math.max(1, Math.floor(maxChars / 4));

  let bestStart = 0;
  let bestScore = -1;

  for (let start = 0; start < text.length; start += step) {
    const window = lower.slice(start, start + maxChars);

    // Coverage dominates frequency. Counting raw occurrences picks the window densest
    // in the COMMONEST term, which is the wrong window: measured 2026-09-27, scoring
    // lou-065 by occurrences chose index 10,000 (thick with "louisiana") over the one
    // at ~107,000 that actually contains "civil law". A window matching three distinct
    // rare terms beats one matching "louisiana" forty times.
    let distinct = 0;
    let hits = 0;
    for (const term of terms) {
      let idx = window.indexOf(term);
      if (idx === -1) continue;
      distinct++;
      let count = 0;
      while (idx !== -1 && count < 50) {
        count++;
        idx = window.indexOf(term, idx + term.length);
      }
      hits += count;
    }

    // A contiguous phrase from the claim outranks any amount of scattered vocabulary.
    // Measured 2026-09-27 on lou-065: the window at index 10,000 matches ELEVEN distinct
    // claim words and does not contain "civil law" anywhere, while the window at 70,000
    // matches ten and contains the phrase. "civil" appears 44 times in that article
    // (mostly "Civil War"); "civil law" appears 7. Words say what a page is about;
    // phrases say whether it states this particular fact.
    let phraseHits = 0;
    for (const phrase of phrases) {
      if (window.includes(phrase)) phraseHits++;
    }

    const score = phraseHits * 1_000_000_000 + distinct * 1_000_000 + hits;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  return text.slice(bestStart, bestStart + maxChars);
}

/** The claim as the player meets it: the question plus the answer it rewards. */
export function claimOf(text: string, correctOption: string): string {
  return `${text} -- the answer treated as correct is "${correctOption}".`;
}

/**
 * Parse the judge's reply.
 *
 * Forgiving about surrounding prose, strict about the verdict vocabulary: anything
 * unrecognised becomes `not-established`, which routes the question to a human rather
 * than silently blessing it.
 */
export function parseJudgement(raw: string): Judgement {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return { verdict: 'not-established', excerpt: '', reasoning: 'unparseable judge reply' };
  }

  try {
    const parsed = JSON.parse(match[0]) as Partial<Judgement>;
    const verdict: Verdict = parsed.verdict === 'supported' ? 'supported' : 'not-established';
    return {
      verdict,
      excerpt: (parsed.excerpt ?? '').slice(0, MAX_SNAPSHOT_CHARS),
      reasoning: parsed.reasoning ?? '',
    };
  } catch {
    return { verdict: 'not-established', excerpt: '', reasoning: 'invalid JSON in judge reply' };
  }
}

export const JUDGE_SYSTEM = [
  "You check whether a cited source establishes a trivia question's answer.",
  '',
  'Answer only from the source text given. Do not use your own knowledge of the subject:',
  'the whole point is to find claims the source no longer supports, and filling the gap',
  'from memory defeats it.',
  '',
  'Reply with JSON only:',
  '{"verdict":"supported"|"not-established","excerpt":"<the sentence that establishes it, verbatim, or empty>","reasoning":"<one sentence>"}',
  '',
  '"supported" requires a passage that establishes the WHOLE claim. If the source covers',
  'part of it, or discusses the topic without stating this fact, that is "not-established".',
].join('\n');

export async function judge(model: string, claim: string, sourceText: string): Promise<Judgement> {
  const { client } = await import('../scripts/content-generation/anthropic-client.js');

  // Window the page against this claim before spending a call on it.
  const window = selectRelevantWindow(sourceText, claim);

  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    system: JUDGE_SYSTEM,
    messages: [{ role: 'user', content: `CLAIM:\n${claim}\n\nSOURCE TEXT:\n${window}` }],
  });

  const text = response.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  return parseJudgement(text);
}
