import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

/**
 * Loads all .txt source documents from a directory.
 * Each document is prefixed with its filename for context in the AI prompt.
 *
 * @param sourceDir - Directory containing .txt files from fetchSources()
 * @returns Array of document strings ready for prompt injection
 */
export async function loadSourceDocuments(sourceDir: string): Promise<string[]> {
  if (!existsSync(sourceDir)) {
    console.warn(`Source directory does not exist: ${sourceDir}`);
    console.warn('Run with --fetch-sources to download source documents first.');
    return [];
  }

  let files: string[];
  try {
    files = readdirSync(sourceDir).filter((f) => f.endsWith('.txt'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to read source directory ${sourceDir}: ${message}`);
    return [];
  }

  if (files.length === 0) {
    console.warn(`No .txt files found in ${sourceDir}`);
    console.warn('Run with --fetch-sources to download source documents first.');
    return [];
  }

  const documents: string[] = [];

  for (const filename of files.sort()) {
    const filepath = join(sourceDir, filename);
    try {
      const content = readFileSync(filepath, 'utf-8');
      const docName = basename(filename, '.txt');
      // Prefix with filename so AI knows which source each document is from
      documents.push(`[DOCUMENT: ${docName}]\n${content}\n[END DOCUMENT: ${docName}]`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to read ${filepath}: ${message}`);
    }
  }

  console.log(`Loaded ${documents.length} source documents from ${sourceDir}`);
  return documents;
}
