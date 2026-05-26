export class FetchJsonTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms.`);
    this.name = "FetchJsonTimeoutError";
  }
}

export function isFetchJsonTimeoutError(error: unknown): error is FetchJsonTimeoutError {
  return error instanceof FetchJsonTimeoutError;
}

export async function fetchJsonWithTimeout<TJson>(
  fetcher: (signal: AbortSignal) => Promise<Response>,
  options: { timeoutMs: number },
): Promise<{ json: TJson; response: Response }> {
  const abortController = new AbortController();
  let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = globalThis.setTimeout(() => {
      abortController.abort();
      reject(new FetchJsonTimeoutError(options.timeoutMs));
    }, options.timeoutMs);
  });

  try {
    const response = await Promise.race([fetcher(abortController.signal), timeoutPromise]);
    const json = (await response.json()) as TJson;
    return { json, response };
  } finally {
    if (timeout) {
      globalThis.clearTimeout(timeout);
    }
  }
}
