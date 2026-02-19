import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

// Model to use for content generation
export const MODEL = 'claude-sonnet-4-5';

// Configured Anthropic client — SDK auto-detects ANTHROPIC_API_KEY from environment
export const client = new Anthropic({
  maxRetries: 3,
  timeout: 120000,
});
