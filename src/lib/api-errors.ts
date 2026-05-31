import "server-only";
import { NextResponse } from "next/server";

// User-facing message catalog. Raw exception text never leaves the server in prod.
const USER_MESSAGES: Record<string, string> = {
  unauthorized: "You must be signed in to do that.",
  forbidden: "You don't have permission to do that.",
  not_found: "The requested resource was not found.",
  invalid_input: "The request contained invalid data.",
  unsupported_url: "We currently support TikTok and Instagram links.",
  rate_limited: "You've saved too many items recently. Try again in an hour.",
  save_failed: "We couldn't save that right now. Please try again.",
  enqueue_failed: "Saved, but analysis couldn't start. Use the retry button.",
  account_not_connected: "That account isn't connected yet.",
  sync_in_progress: "We're already syncing this account. Hang tight.",
  provider_unavailable: "That platform isn't available to sync right now.",
  internal: "Something went wrong on our end. Please try again.",
};

type ErrorCode = keyof typeof USER_MESSAGES;

interface ErrorResponseOptions {
  /** Raw error for server-side logging (never sent to client in prod). */
  cause?: unknown;
  /** Extra fields merged into the JSON body (only in dev). */
  devDetail?: Record<string, unknown>;
  /** Additional response headers (e.g. Retry-After). */
  headers?: Record<string, string>;
}

const STATUS_MAP: Partial<Record<ErrorCode, number>> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  unsupported_url: 400,
  rate_limited: 429,
  account_not_connected: 404,
  sync_in_progress: 409,
  provider_unavailable: 503,
};

function httpStatus(code: ErrorCode): number {
  return STATUS_MAP[code] ?? 500;
}

/**
 * Return a NextResponse with a curated error message.
 * In production, clients only see the code + catalog message.
 * In development, the raw cause is included for debugging.
 */
export function apiError(
  code: ErrorCode,
  options: ErrorResponseOptions = {},
): NextResponse {
  const { cause, devDetail, headers } = options;

  if (cause) {
    console.error(`[api-error] ${code}`, cause);
  }

  const isDev = process.env.NODE_ENV !== "production";

  const body: Record<string, unknown> = {
    error: USER_MESSAGES[code],
    code,
  };

  if (isDev && cause) {
    body.dev_cause =
      cause instanceof Error ? cause.message : String(cause);
  }
  if (isDev && devDetail) {
    Object.assign(body, devDetail);
  }

  return NextResponse.json(body, {
    status: httpStatus(code),
    headers,
  });
}

/** Convenience: 429 with Retry-After header derived from the reset epoch ms. */
export function rateLimitedResponse(resetAt?: number): NextResponse {
  const headers: Record<string, string> = {};
  if (resetAt) {
    const secondsUntilReset = Math.max(
      0,
      Math.ceil((resetAt - Date.now()) / 1000),
    );
    headers["Retry-After"] = String(secondsUntilReset);
  }
  return apiError("rate_limited", { headers });
}
