import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

/** Upstream background services that talk to Cindy's cloud or CDN. */
export type UpstreamService =
  | 'analytics'
  | 'heartbeat'
  | 'logUpload'
  | 'updater'
  | 'agentBinaryUpdate';

const ALL_UPSTREAM_SERVICES: readonly UpstreamService[] = [
  'analytics',
  'heartbeat',
  'logUpload',
  'updater',
  'agentBinaryUpdate',
];

/** Services that must not start. Countersign is local-only: all of them. */
const DISABLED: ReadonlySet<UpstreamService> = new Set(LOCAL_ONLY ? ALL_UPSTREAM_SERVICES : []);

export function isServiceDisabled(name: UpstreamService): boolean {
  return DISABLED.has(name);
}
