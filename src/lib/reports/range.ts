import { ApiError } from "@/lib/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses ?from=&to= query params, defaulting to the last 30 days. */
export function parseRange(searchParams: URLSearchParams): { from: string; to: string } {
  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);

  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? defaultTo;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw new ApiError("invalid_request", "from/to must be YYYY-MM-DD", 400);
  }
  if (from > to) {
    throw new ApiError("invalid_request", "from must be before to", 400);
  }
  return { from, to };
}
