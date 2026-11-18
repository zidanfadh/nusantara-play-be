/**
 * Redacts secrets from request bodies before they are written to audit_log
 * (Phase 06, P2). POST /auth/change-password is audited, and the body holds
 * currentPassword, newPassword and confirmPassword in plain text.
 */
export const REDACTED = '[REDACTED]';

const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization/i;

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 10 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SECRET_KEY.test(key)
      ? REDACTED
      : redactSecrets(entry, depth + 1);
  }
  return result;
}
