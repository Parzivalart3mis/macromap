export class FetchError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Fetch wrapper that unwraps the API's { error: { code, message } } shape. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let code = "request_failed";
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error?.message) {
        code = body.error.code ?? code;
        message = body.error.message;
      }
    } catch {
      // Non-JSON error body — keep defaults.
    }
    throw new FetchError(code, message, response.status);
  }
  return (await response.json()) as T;
}
