/**
 * Type declarations for link-check package
 * This package doesn't have official TypeScript types
 */

declare module 'link-check' {
  interface LinkCheckOptions {
    timeout?: number;
    baseUrl?: string;
    headers?: Record<string, string>;
  }

  interface LinkCheckResult {
    link: string;
    status: 'alive' | 'dead';
    statusCode?: number;
    err?: string | null;
  }

  type LinkCheckCallback = (
    err: Error | null,
    result: LinkCheckResult
  ) => void;

  function linkCheck(
    link: string,
    callback: LinkCheckCallback
  ): void;

  function linkCheck(
    link: string,
    options: LinkCheckOptions,
    callback: LinkCheckCallback
  ): void;

  export = linkCheck;
}
