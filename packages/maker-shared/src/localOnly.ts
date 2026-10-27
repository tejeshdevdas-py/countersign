/**
 * Countersign is local-only: every feature that needs the upstream cloud
 * service is switched off at its entry point.
 */
export const LOCAL_ONLY = true as const;

/** Thrown by an entry point that needs the upstream cloud service. */
export class LocalOnlyError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available in Countersign: it needs a cloud service that this local-only app does not use.`);
    this.name = 'LocalOnlyError';
  }
}

export * from './localOnlyEngine.js';
