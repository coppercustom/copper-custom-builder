// Pure, dependency-free consultation intake safeguards. Not deployed to production.
// Timeouts are explicit; IP must come from a gateway-verified header, never client input.
export async function withTimeout(task, timeoutMs, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new RangeError('timeoutMs');
  const controller = new AbortController();
  let timer;
  try {
    timer = setTimer(() => controller.abort(), timeoutMs);
    return await task(controller.signal);
  } finally {
    if (timer !== undefined) clearTimer(timer);
  }
}
export function classifyTurnstile(verdict, expectedHostnames) {
  return Boolean(verdict && verdict.success === true &&
    typeof verdict.hostname === 'string' && expectedHostnames.includes(verdict.hostname));
}
export function normalizeTrustedIp(value, verifiedByGateway) {
  if (!verifiedByGateway || typeof value !== 'string') return null;
  const v = value.trim();
  // Deliberately reject chains, CRLF, and suspicious values; production needs platform-specific trust validation.
  if (!v || v.length > 45 || /[,\s]/.test(v) || !/^[0-9a-fA-F:.]+$/.test(v)) return null;
  return v;
}
export function allowWindowAttempt(currentCount, limit = 5) {
  if (!Number.isSafeInteger(currentCount) || currentCount < 0 ||
      !Number.isSafeInteger(limit) || limit < 1) throw new RangeError('count/limit');
  return currentCount < limit;
}
