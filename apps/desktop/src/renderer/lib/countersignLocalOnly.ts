import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared/local-only';

/** The message the main process throws for a switched-off cloud feature. */
export function localOnlyMessage(feature: string): string {
  return new LocalOnlyError(feature).message;
}

const LOCAL_ONLY_SENTENCE = /([^:'"\n]*? is not available in Countersign: it needs a cloud service that this local-only app does not use\.)/;

/**
 * Extracts a LocalOnlyError message from an IPC rejection
 * ("Error invoking remote method 'x': LocalOnlyError: <message>"), or null.
 */
export function localOnlyMessageFromError(error: unknown): string | null {
  if (!LOCAL_ONLY) return null;
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const match = LOCAL_ONLY_SENTENCE.exec(text);
  return match ? match[1].trim() : null;
}
