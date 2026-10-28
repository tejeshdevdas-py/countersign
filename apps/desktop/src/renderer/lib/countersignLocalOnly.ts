import i18next from 'i18next';
import { LOCAL_ONLY, LocalOnlyError } from '@cindy/maker-shared/local-only';

const MESSAGE_KEY = 'countersignLocalOnly.notAvailable';

/**
 * The message for a switched-off cloud feature, in the UI language. In English it is the
 * text of the LocalOnlyError that the main process throws; before i18n starts it is that text.
 */
export function localOnlyMessage(feature: string): string {
  const english = new LocalOnlyError(feature).message;
  if (!i18next.isInitialized) return english;
  const text: unknown = i18next.t(MESSAGE_KEY, { feature, defaultValue: english });
  return typeof text === 'string' && text !== MESSAGE_KEY ? text : english;
}

const LOCAL_ONLY_SENTENCE = /([^:'"\n]*?) is not available in Countersign: it needs a cloud service that this local-only app does not use\./;

/**
 * Extracts a LocalOnlyError message from an IPC rejection
 * ("Error invoking remote method 'x': LocalOnlyError: <message>") and returns it in the UI
 * language, or null.
 */
export function localOnlyMessageFromError(error: unknown): string | null {
  if (!LOCAL_ONLY) return null;
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const match = LOCAL_ONLY_SENTENCE.exec(text);
  return match ? localOnlyMessage(match[1].trim()) : null;
}
