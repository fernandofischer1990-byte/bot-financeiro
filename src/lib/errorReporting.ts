/**
 * Captura de erros no front (M9). Cada erro recebe um identificador e é
 * correlacionado ao último request-id devolvido pelas edge functions.
 */
import { logger } from './logger';

let lastRequestId: string | null = null;

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function rememberRequestId(id: string | null | undefined) {
  if (id) lastRequestId = id;
}

export function getLastRequestId(): string | null {
  return lastRequestId;
}

export interface ErrorReport {
  errorId: string;
  requestId: string | null;
}

export function reportError(
  error: unknown,
  source: string,
  extra: Record<string, unknown> = {},
): ErrorReport {
  const errorId = crypto.randomUUID().slice(0, 8);
  const requestId =
    (extra.requestId as string | undefined) ??
    (error as { requestId?: string } | null)?.requestId ??
    lastRequestId;
  const message = error instanceof Error ? error.message : String(error);
  logger.error(
    `[Error] ${source}`,
    JSON.stringify({ error_id: errorId, request_id: requestId, message, route: window.location.pathname, ...extra }),
    error,
  );
  return { errorId, requestId };
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window.onerror'));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'unhandledrejection'));
}
