/**
 * Logger de desenvolvimento: silencioso em produção.
 * `logger.error` sempre passa, pois erros são relevantes em produção também.
 */
const DEV = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (DEV) console.log(...args);
  },
  info: (...args: unknown[]) => {
    if (DEV) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (DEV) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
