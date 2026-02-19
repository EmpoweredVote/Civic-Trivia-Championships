import { load } from 'cheerio';
import pLimit from 'p-limit';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Slugifies a URL into a safe filename.
 * e.g. "https://bloomington.in.gov/city-council" → "bloomington-in-gov-city-council"
 */
function urlToFilename(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100);
}

/**
 * Fetches a single URL and extracts clean readable text from the HTML.
 * Strips navigation, footers, scripts, styles, and other non-content elements.
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CivicTriviaBot/1.0 (civic education content generation; +https://github.com/EmpoweredVote/Civic-Trivia-Championships)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`  HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Remove non-content elements
    $('script, style, nav, footer, header, aside, noscript, iframe, form').remove();
    $('[class*="nav"], [class*="menu"], [class*="sidebar"], [class*="footer"], [class*="header"]').remove();
    $('[id*="nav"], [id*="menu"], [id*="sidebar"], [id*="footer"], [id*="header"]').remove();

    // Extract text from main content areas, fallback to body
    const mainContent = $('main, article, .content, #content, #main, [role="main"]');
    const textSource = mainContent.length > 0 ? mainContent : $('body');

    const text = textSource
      .text()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length < 100) {
      console.warn(`  Minimal content extracted from ${url} (${text.length} chars)`);
      return text.length > 0 ? text : null;
    }

    return text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`  Failed to fetch ${url}: ${message}`);
    return null;
  }
}

/**
 * Fetches source URLs, extracts clean text, and saves to outputDir as .txt files.
 * Uses p-limit(3) for concurrent fetches to avoid overwhelming servers.
 *
 * @param sourceUrls - Array of authoritative URLs to fetch
 * @param outputDir - Directory to save clean text files
 * @returns Summary of successful and failed fetches
 */
export async function fetchSources(
  sourceUrls: string[],
  outputDir: string
): Promise<{ success: number; failed: number; files: string[] }> {
  mkdirSync(outputDir, { recursive: true });

  const limit = pLimit(3);
  const files: string[] = [];
  let failed = 0;

  console.log(`Fetching ${sourceUrls.length} source URLs to ${outputDir}...`);

  const tasks = sourceUrls.map((url) =>
    limit(async () => {
      console.log(`  Fetching: ${url}`);
      const text = await fetchPage(url);

      if (text) {
        const filename = `${urlToFilename(url)}.txt`;
        const filepath = join(outputDir, filename);
        const content = `SOURCE: ${url}\n${'='.repeat(60)}\n${text}\n`;
        writeFileSync(filepath, content, 'utf-8');
        files.push(filepath);
        console.log(`  Saved: ${filename} (${text.length} chars)`);
      } else {
        failed++;
        console.warn(`  Skipped: ${url} (no content extracted)`);
      }
    })
  );

  await Promise.all(tasks);

  console.log(`\nFetch complete: ${files.length} saved, ${failed} failed`);
  return { success: files.length, failed, files };
}
