import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/** Upstream background services that talk to Cindy's cloud or CDN. */
export type UpstreamService =
  | 'analytics'
  | 'heartbeat'
  | 'logUpload'
  | 'updater'
  | 'agentBinaryUpdate';

/** True when the service must not start. Countersign is local-only: all of them. */
export function isServiceDisabled(_name: UpstreamService): boolean {
  return LOCAL_ONLY;
}
