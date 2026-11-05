import type { Company, Lang } from "./types";

/** The default autocomplete endpoint. */
export const DEFAULT_ENDPOINT = "https://api.firmatlas.be/v1/autocomplete";

/** Raised when the API refuses or fails, so the widget can fall back to a plain field. */
export class ApiError extends Error {
  /** The HTTP status, or 0 for a network failure. */
  readonly status: number;
  /** The API's error code, when it sent one. */
  readonly code: string | null;

  /** Builds an error from a status and the API's error body. */
  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Fetches up to `limit` companies for a query. Rejects with AbortError when the signal aborts. */
export async function fetchCompanies(
  q: string,
  o: { key: string; lang: Lang; limit: number; endpoint: string; signal: AbortSignal },
): Promise<Company[]> {
  const url = new URL(o.endpoint);
  url.searchParams.set("q", q);
  url.searchParams.set("lang", o.lang);
  url.searchParams.set("limit", String(o.limit));
  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-Api-Key": o.key }, signal: o.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, null, "The Firmatlas API could not be reached.");
  }
  if (!res.ok) {
    let code: string | null = null;
    let message = `The Firmatlas API answered ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? null;
      if (body.error?.message) message = body.error.message;
    } catch {
      // Not the API's JSON error shape; keep the status message.
    }
    throw new ApiError(res.status, code, message);
  }
  const body = (await res.json()) as { data?: Company[] };
  return Array.isArray(body.data) ? body.data : [];
}

/**
 * Reports whether a query looks like an enterprise or VAT number (digits,
 * dots, spaces, an optional BE prefix, at least 4 digits). Those are searched
 * at once; names wait for 3 characters.
 */
export function looksLikeNumber(q: string): boolean {
  const s = q.trim();
  return /^(be)?[\d.\s-]+$/i.test(s) && s.replace(/\D/g, "").length >= 4;
}

/** Reports whether a query is worth sending. */
export function shouldSearch(q: string): boolean {
  return q.trim().length >= 3 || looksLikeNumber(q);
}
