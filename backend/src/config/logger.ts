/** Minimal logger wrapper. Swap with pino/winston if needed. */
const logger = {
  info: (...a: unknown[]) => console.log('[INFO]', ...a),
  warn: (...a: unknown[]) => console.warn('[WARN]', ...a),
  error: (...a: unknown[]) => console.error('[ERROR]', ...a),
};
export default logger;
