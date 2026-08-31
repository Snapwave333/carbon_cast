/**
 * Credential redaction for everything the agent-control bridge emits.
 *
 * Every payload leaving the bridge — HTTP responses, SSE frames, and the
 * audit log — passes through `sanitize` first, so a stream URL, portal
 * password, or bearer token cannot reach an agent even if some new operation
 * forgets to filter its own result. Redacting centrally is what lets the
 * renderer-side handlers stay simple.
 *
 * The key pattern is deliberately broad and matches on *name*, not value:
 * a field called `path` comes back `[redacted]` whether or not it holds
 * anything sensitive. That is why `diagnostics.screenshot` reports its
 * filename as `file`.
 */

const protectedKeys =
    /(?:token|password|credential|secret|stream|source|url|path|authorization)/i;

type JsonObject = Record<string, unknown>;

export function sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value as JsonObject).map(([key, item]) => [
            key,
            protectedKeys.test(key) ? '[redacted]' : sanitize(item),
        ])
    );
}
