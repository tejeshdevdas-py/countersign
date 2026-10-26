import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/** Countersign is local-only: the usage-analytics SDK is never initialised. */
export function shouldInitTapdb(): boolean {
  return !LOCAL_ONLY;
}
